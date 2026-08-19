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
        return {
          memory: candidate,
          score: this.calculateHybridScore(candidate, taskDescription)
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
          c.memory.times_retrieved += 1;
          c.memory.last_used_at = new Date().toISOString();
          // Fire & forget update
          this.vectorStore.store(c.memory, queryVector).catch(() => {});
          return c.memory;
        });

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
    let score = 0.5;

    // 1. Reliability & Confidence (up to +0.2)
    score += (memory.confidence * 0.1);
    score += (memory.reliability * 0.1);

    // 2. Keyword Match (up to +0.15)
    const taskLower = taskDescription.toLowerCase();
    if (memory.task && taskLower.includes(memory.task.toLowerCase().substring(0, 20))) {
      score += 0.1;
    }
    if (memory.tags) {
      const matchCount = memory.tags.filter(tag => taskLower.includes(tag.toLowerCase())).length;
      score += Math.min(matchCount * 0.05, 0.15);
    }

    // 3. Environment Match (up to +0.15)
    const currentOs = process.platform;
    if (memory.environment?.os === currentOs) {
      score += 0.1;
    }

    // 4. Historical Usefulness (up to +0.1)
    const totalUses = memory.times_helped + memory.times_failed;
    if (totalUses > 0) {
      const successRate = memory.times_helped / totalUses;
      score += (successRate * 0.1);
      if (memory.times_failed > 3 && successRate < 0.2) {
        // Penalize heavily failed memories
        score -= 0.3;
      }
    }

    // 5. Memory Type weight
    // We want to heavily prioritize Mistake Preventions and Procedural Rules
    if (memory.memory_type === 'mistake') score += 0.15;
    if (memory.memory_type === 'procedural') score += 0.1;
    
    return Math.max(0, Math.min(1, score)); // Clamp 0-1
  }

  /**
   * Formats the retrieved memories into a concise text block for the LLM System Prompt
   */
  public formatMemoriesForPrompt(memories: MemoryRecord[]): string {
    if (memories.length === 0) return '';

    let prompt = `\n\n## Agent Self-Learning Memory (Retrieval-Augmented)\n`;
    prompt += `The following past experiences were retrieved based on semantic similarity to the current task. Use them to guide your strategy, PREVENT repeating known mistakes, and reuse proven procedures. Treat this as evidence, not absolute truth.\n\n`;

    for (let i = 0; i < memories.length; i++) {
      const m = memories[i];
      prompt += `### Experience #${i + 1} [Type: ${m.memory_type.toUpperCase()}]\n`;
      prompt += `- **Confidence**: ${Math.round(m.confidence * 100)}%\n`;
      if (m.task) prompt += `- **Context**: ${m.task}\n`;
      
      if (m.memory_type === 'mistake') {
        if (m.error) prompt += `- **Error/Failure**: ${m.error}\n`;
        if (m.root_cause) prompt += `- **Root Cause**: ${m.root_cause}\n`;
        if (m.prevention) prompt += `- **PREVENTION RULE**: ${m.prevention}\n`;
      } else if (m.memory_type === 'procedural' || m.memory_type === 'semantic') {
        if (m.general_lesson) prompt += `- **Lesson/Procedure**: ${m.general_lesson}\n`;
      } else {
        if (m.action) prompt += `- **Action Taken**: ${m.action}\n`;
        if (m.result) prompt += `- **Result**: ${m.result}\n`;
      }
      prompt += '\n';
    }

    prompt += `CRITICAL DIRECTIVE: Do NOT repeat a documented mistake. If an environment mismatch exists, adapt the solution.\n`;
    
    return prompt;
  }
}
