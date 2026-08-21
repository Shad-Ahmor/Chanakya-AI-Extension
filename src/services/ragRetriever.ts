import { VectorStore } from './memory/VectorStore';
import { EmbeddingService } from './memory/EmbeddingService';
import { Logger } from '../utils/logger';
import { DocumentChunk } from '../types/memory';

export interface RagRetrievalResult {
  chunk: DocumentChunk;
  score: number;
}

export class RagRetriever {
  private static instance: RagRetriever;
  private logger = Logger.getInstance();

  private constructor() {}

  public static getInstance(): RagRetriever {
    if (!RagRetriever.instance) {
      RagRetriever.instance = new RagRetriever();
    }
    return RagRetriever.instance;
  }

  public async retrieve(query: string, topK: number = 5, threshold: number = 0.7): Promise<RagRetrievalResult[]> {
    const startTime = Date.now();
    try {
      this.logger.log(`[RagRetriever] Retrieving chunks for query: "${query}"`);
      
      // 1. Query Embedding
      const queryVector = await EmbeddingService.getInstance().getEmbedding(query);
      
      // 2. Vector Search (fetch slightly more candidates for filtering/deduplication)
      const candidateCount = topK * 2;
      const candidates = await VectorStore.getInstance().searchChunks(queryVector, candidateCount);
      
      this.logger.log(`Raw candidate scores: ${candidates.map(c => c.score).join(', ')}`);

      if (!candidates || candidates.length === 0) {
        this.logDiagnostics(query, queryVector.length, candidateCount, topK, 0, []);
        return [];
      }

      // 3. Filter by similarity threshold
      // NOTE: If vectra returns distance instead of similarity, we might need to convert it or flip logic.
      // Assuming vectra returns cosine similarity or similar metric where higher is better. 
      // If it returns distance (lower is better), we need a different check.
      const validCandidates = candidates.filter(c => c.score >= threshold);

      // 4. Deduplicate (if multiple overlapping chunks from the same document cover the same context)
      // For MVP, we can deduplicate by exact chunk ID or by heavily overlapping content
      // vectra ensures unique IDs, but we should make sure we don't return duplicate content blocks if ingestion duplicated them.
      const uniqueChunks = new Map<string, RagRetrievalResult>();
      for (const candidate of validCandidates) {
        if (!uniqueChunks.has(candidate.chunk.chunk_id)) {
          uniqueChunks.set(candidate.chunk.chunk_id, candidate);
        }
      }

      // 5. Sort by score descending (vectra already does this, but we filter/map)
      const sortedResults = Array.from(uniqueChunks.values()).sort((a, b) => b.score - a.score);

      // 6. Top-K
      const finalResults = sortedResults.slice(0, topK);

      const latency = Date.now() - startTime;
      this.logger.log(`[RagRetriever] Retrieved ${finalResults.length} chunks in ${latency}ms`);
      
      this.logDiagnostics(
        query, 
        queryVector.length, 
        candidateCount, 
        topK, 
        finalResults.length, 
        finalResults.map(r => r.score)
      );

      return finalResults;
    } catch (error) {
      this.logger.error('[RagRetriever] Error during RAG retrieval', error);
      return [];
    }
  }

  private logDiagnostics(
    query: string, 
    queryEmbeddingDimension: number, 
    candidateCount: number, 
    topK: number, 
    returnedChunks: number, 
    similarityScores: number[]
  ) {
    console.log('RETRIEVAL_DIAGNOSTICS');
    console.log(`query=${query}`);
    console.log(`queryEmbeddingDimension=${queryEmbeddingDimension}`);
    console.log(`candidateCount=${candidateCount}`);
    console.log(`topK=${topK}`);
    console.log(`returnedChunks=${returnedChunks}`);
    console.log(`similarityScores=${similarityScores.join(', ')}`);
  }
}
