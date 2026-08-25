import { MemoryRecord } from '../../types/memory';
import { VectorStore } from './VectorStore';
import { EmbeddingService } from './EmbeddingService';
import { Logger } from '../../utils/logger';

export class MemoryRetriever {
  private static instance: MemoryRetriever;
  private logger = Logger.getInstance();
  private vectorStore = VectorStore.getInstance();
  private embeddingService = EmbeddingService.getInstance();

  private constructor() {}

  public static getInstance(): MemoryRetriever {
    if (!MemoryRetriever.instance) {
      MemoryRetriever.instance = new MemoryRetriever();
    }
    return MemoryRetriever.instance;
  }

  /**
   * Performs hybrid retrieval using vector similarity + metadata scoring
   */
  public async retrieve(taskDescription: string, topK: number = 5): Promise<MemoryRecord[]> {
    try {
      this.logger.log(`Retrieving memory for task: "${taskDescription.substring(0, 50)}..."`);
      
      const queryVector = await this.embeddingService.getEmbedding(taskDescription);
      
      // We retrieve a larger candidate pool to rerank them manually
      const candidates = await this.vectorStore.search(queryVector, topK * 3);
      
      if (!candidates || candidates.length === 0) {
        return [];
      }

      // Hybrid scoring
      const scoredCandidates = candidates.map(candidate => {
        let score = this.calculateHybridScore(candidate, taskDescription);
        
        // Phase 6 & 7: Cross-Task Generalization
        // Boost score if the memory is procedural and shares keywords with the current task,
        // even if exact vector match is slightly lower.
        if (candidate.type === 'SUCCESSFUL_PROCEDURE' && candidate.content) {
            const taskLower = taskDescription.toLowerCase();
            const memoryTaskLower = candidate.task.toLowerCase();
            
            // Example generalization heuristic: both are "React component" modifications
            if (taskLower.includes('react') && memoryTaskLower.includes('react')) {
                score += 0.15;
            }
            if (taskLower.includes('bug') && memoryTaskLower.includes('bug')) {
                score += 0.10;
            }
        }
        if (score > 1) score = 1;

        // Assign applicability
        candidate.applicability = score;

        return {
          memory: candidate,
          score: score
        };
      });

      // Sort by final score descending
      scoredCandidates.sort((a, b) => b.score - a.score);

      // Filter out low confidence/reliability memories and return top K
      const threshold = 0.4;
      const validMemories = scoredCandidates
        .filter(c => c.score > threshold && c.memory.status === 'active')
        .slice(0, topK)
        .map(c => {
          // Update times retrieved
          c.memory.metadata.lastUsedAt = Date.now();
          // Update in the vector store
          this.vectorStore.store(c.memory, queryVector).catch(() => {});
          return c.memory;
        });

      console.log(`\n[Memory] Retrieved: ${validMemories.length} memories`);
      const mistakeMemory = validMemories.find(m => m.type === 'AGENT_ERROR');
      if (mistakeMemory) {
        console.log(`[Memory] Relevant mistake: unverified filesystem path\n`);
      }

      return validMemories;
    } catch (err) {
      this.logger.error('Error during memory retrieval', err);
      return [];
    }
  }

  private calculateHybridScore(memory: MemoryRecord, taskDescription: string): number {
    // Basic vector similarity is already implicitly handled by the fact that it was returned 
    // by vectorStore (which uses cosine similarity). But since we just have the objects here,
    // we use a heuristic based on metadata. In a real system, VectorStore would return the raw distance.
    // For MVP, we assume base score is 0.5 and we add/subtract based on rules.
    let score = memory.confidence;

    // Weight by importance
    // score = (score * 0.7) + (memory.importance * 0.3);

    // Boost if recent/frequently retrieved
    // const daysSinceCreation = (Date.now() - (memory.metadata.createdAt || Date.now())) / (1000 * 60 * 60 * 24);
    // score *= Math.exp(-daysSinceCreation * 0.01); 

    // Adjust based on tags matching
    if (memory.metadata?.tags && memory.metadata.tags.length > 0) {
      const taskWords = taskDescription.toLowerCase().split(/\s+/);
      const tagMatch = memory.metadata.tags.some(tag => taskWords.includes(tag.toLowerCase()));
      if (tagMatch) score += 0.1;
    }

    // Adjust based on environment matching
    // if (memory.metadata?.environment && memory.metadata.environment.os === process.platform) {
    //   score += 0.05;
    // }

    // Phase 4: Confidence Evolution
    // If it has been used multiple times and failed often, drastically reduce score
    const totalUses = (memory.metadata?.successCount || 0) + (memory.metadata?.failureCount || 0);
    if (totalUses > 0) {
      const successRate = (memory.metadata?.successCount || 0) / totalUses;
      
      if ((memory.metadata?.failureCount || 0) > 3 && successRate < 0.2) {
        score -= 0.5; // Heavy penalty for proven bad memories
      } else {
        // Mild boost for proven good memories
        score += (successRate * 0.1);
      }
    }

    // Boost score depending on type
    if (memory.type === 'AGENT_ERROR') score += 0.15;
    if (memory.type === 'SUCCESSFUL_PROCEDURE') score += 0.1;
    
    return Math.max(0, Math.min(1, score)); // Clamp 0-1
  }

  /**
   * Formats the retrieved memories into a concise text block for the LLM System Prompt
   */
  public formatMemoriesForPrompt(memories: MemoryRecord[]): string {
    if (memories.length === 0) return '';

    let prompt = `\n\n## Agent Self-Learning Memory (Retrieval-Augmented)\n`;
    prompt += `The following past experiences were retrieved based on semantic similarity to the current task. Use them to guide your strategy, PREVENT repeating known mistakes, and reuse proven procedures. Treat this as evidence, not absolute truth.\n\n`;

    memories.forEach((m, i) => {
      prompt += `### Experience #${i + 1} [Type: ${m.type.toUpperCase()}]\n`;
      prompt += `Task: ${m.task}\n`;
      prompt += `Title: ${m.title}\n`;
      
      if (m.type === 'AGENT_ERROR') {
        if (m.error) prompt += `Error Encountered: ${m.error}\n`;
        prompt += `Lesson / Prevention: ${m.content}\n`;
      } else if (m.type === 'SUCCESSFUL_PROCEDURE') {
        prompt += `Content: ${m.content}\n`;
      }
      
      prompt += `\n`;
    });

    prompt += `CRITICAL DIRECTIVE: Do NOT repeat a documented mistake. If an environment mismatch exists, adapt the solution.\n`;
    
    return prompt;
  }
}
