import * as path from 'path';
import * as vscode from 'vscode';
import { LocalIndex } from 'vectra';
import { MemoryRecord } from '../../types/memory';
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
      
      // We will use 1536 dimensions as default for standard embeddings (like OpenAI)
      // or we can recreate the index if the dimension changes. For MVP we assume a fixed dimension 
      // or we let vectra handle it (vectra requires specifying dimensions if creating a new index).
      // Let's default to 1536, but local models might be 768 or 384. 
      // For a robust system, we would need to dynamically determine this based on the model.
      
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

  public async store(record: MemoryRecord, vector: number[]): Promise<void> {
    if (!this.isInitialized) return;
    try {
      // Upsert the item
      await this.index.upsertItem({
        id: record.memory_id,
        vector: vector,
        metadata: record as unknown as Record<string, any>
      });
      this.logger.log(`Stored memory: ${record.memory_id} [${record.memory_type}]`);
    } catch (error) {
      this.logger.error('Failed to store memory vector', error);
    }
  }

  public async search(vector: number[], topK: number = 5): Promise<MemoryRecord[]> {
    if (!this.isInitialized) return [];
    try {
      const results = await this.index.queryItems(vector, '', topK);
      return results.map(r => r.item.metadata as unknown as MemoryRecord);
    } catch (error) {
      this.logger.error('Failed to search memory vector', error);
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

  public async delete(memoryId: string): Promise<void> {
    if (!this.isInitialized) return;
    try {
      await this.index.deleteItem(memoryId);
    } catch (error) {
      this.logger.error(`Failed to delete memory ${memoryId}`, error);
    }
  }
}
