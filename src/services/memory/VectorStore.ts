import * as path from 'path';
import * as vscode from 'vscode';
import { LocalIndex } from 'vectra';
import { MemoryRecord, DocumentChunk } from '../../types/memory';
import { Logger } from '../../utils/logger';

export class VectorStore {
  private static instance: VectorStore;
  private index!: LocalIndex;
  private isInitialized = false;
  private logger = Logger.getInstance();

  private constructor() {}

  public static getInstance(): VectorStore {
    if (!VectorStore.instance) {
      VectorStore.instance = new VectorStore();
    }
    return VectorStore.instance;
  }

  public async initialize(globalStorageUri: vscode.Uri): Promise<void> {
    if (this.isInitialized) return;

    try {
      const dbPath = path.join(globalStorageUri.fsPath, 'chanakya_memory_db');
      
      this.index = new LocalIndex(dbPath);
      
      if (!await this.index.isIndexCreated()) {
        await this.index.createIndex();
      }
      
      this.isInitialized = true;
      this.logger.log('Vector store initialized successfully at: ' + dbPath);
    } catch (error) {
      this.logger.error('Failed to initialize Vector Store', error);
    }
  }

  private validateVector(vector: number[]) {
    // vectra by default uses 1536 if created without config, or infers from first item
    if (!vector || vector.length === 0) {
      throw new Error('Vector is empty or invalid.');
    }
  }

  public async store(record: MemoryRecord, vector: number[]): Promise<void> {
    if (!this.isInitialized) return;
    try {
      this.validateVector(vector);
      // Upsert the item
      await this.index.upsertItem({
        id: record.id,
        vector: vector,
        metadata: record as unknown as Record<string, any>
      });
      this.logger.log(`Stored memory: ${record.id} [${record.type}]`);
    } catch (error) {
      this.logger.error('Failed to store memory vector', error);
    }
  }

  public async storeChunk(chunk: DocumentChunk, vector: number[]): Promise<void> {
    if (!this.isInitialized) return;
    try {
      this.validateVector(vector);
      await this.index.upsertItem({
        id: chunk.chunk_id,
        vector: vector,
        metadata: chunk as unknown as Record<string, any>
      });
      this.logger.log(`Stored chunk: ${chunk.chunk_id} for doc: ${chunk.document_id}`);
    } catch (error) {
      this.logger.error('Failed to store document chunk vector', error);
      throw error;
    }
  }

  /**
   * Search for similar vectors
   */
  public async search(vector: number[], topK: number = 5): Promise<MemoryRecord[]> {
    if (!this.isInitialized || !vector || vector.length === 0) return [];
    try {
      const results = await this.index.queryItems(vector, '', topK);
      return results.map(r => r.item.metadata as unknown as MemoryRecord);
    } catch (error) {
      this.logger.error('Failed to search memory vector', error);
      return [];
    }
  }

  public async searchChunks(vector: number[], topK: number = 5): Promise<{ chunk: DocumentChunk; score: number }[]> {
    if (!this.isInitialized || !vector || vector.length === 0) return [];
    try {
      // Query items returns { item: LocalIndexItem, score: number }
      // The score is the cosine similarity (or distance based on vectra internals).
      // According to vectra, it returns items sorted by similarity.
      const results = await this.index.queryItems(vector, '', topK);
      this.logger.log(`[VectorStore] Raw queryItems length: ${results.length}`);
      if (results.length > 0) {
        this.logger.log(`[VectorStore] First result metadata: ${JSON.stringify(results[0].item.metadata)}`);
      }
      
      const chunks = results
        .filter(r => r.item.metadata && (r.item.metadata as any).chunk_id) // ensure it's a DocumentChunk, not a MemoryRecord
        .map(r => ({
          chunk: r.item.metadata as unknown as DocumentChunk,
          score: r.score
        }));
        
      return chunks;
    } catch (error) {
      this.logger.error('Failed to search document chunks', error);
      return [];
    }
  }

  public async get(memoryId: string): Promise<MemoryRecord | null> {
    if (!this.isInitialized) return null;
    try {
      const item = await this.index.getItem(memoryId);
      return item ? item.metadata as unknown as MemoryRecord : null;
    } catch (error) {
      this.logger.error(`Failed to get memory ${memoryId}`, error);
      return null;
    }
  }

  public async getAllMemories(): Promise<MemoryRecord[]> {
    if (!this.isInitialized) return [];
    try {
      const items = await this.index.listItems();
      return items.map(item => item.metadata as unknown as MemoryRecord);
    } catch (error) {
      this.logger.error(`Failed to get all memories`, error);
      return [];
    }
  }

  public async delete(memoryId: string): Promise<void> {
    if (!this.isInitialized) return;
    try {
      await this.index.deleteItem(memoryId);
    } catch (error) {
      this.logger.error(`Failed to delete memory ${memoryId}`, error);
    }
  }

  public async beginUpdate(): Promise<void> {
    if (!this.isInitialized) return;
    try {
      await this.index.beginUpdate();
    } catch (error) {
      this.logger.error('Failed to begin update on VectorStore', error);
    }
  }

  public async endUpdate(): Promise<void> {
    if (!this.isInitialized) return;
    try {
      await this.index.endUpdate();
    } catch (error) {
      this.logger.error('Failed to end update on VectorStore', error);
    }
  }

  public async deleteByDocumentId(documentId: string): Promise<void> {
    if (!this.isInitialized) return;
    try {
      await this.beginUpdate();
      // Find all items with matching document_id
      const items = await this.index.listItems();
      const chunksToDelete = items.filter(item => item.metadata && item.metadata.document_id === documentId);
      
      for (const chunk of chunksToDelete) {
        await this.index.deleteItem(chunk.id);
      }
      await this.endUpdate();
      this.logger.log(`Deleted ${chunksToDelete.length} existing chunks for document: ${documentId}`);
    } catch (error) {
      this.logger.error(`Failed to delete chunks for document ${documentId}`, error);
      this.index.cancelUpdate();
      throw error;
    }
  }
}
