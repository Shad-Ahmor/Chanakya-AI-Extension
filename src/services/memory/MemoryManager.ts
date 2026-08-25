import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';
import { MemoryRecord, MemoryType } from '../../types/memory';
import { VectorStore } from './VectorStore';
import { EmbeddingService } from './EmbeddingService';
import { Logger } from '../../utils/logger';
import { SelfLearningTelemetry } from './SelfLearningTelemetry';

export class MemoryManager {
  private static instance: MemoryManager;
  private logger = Logger.getInstance();
  private vectorStore = VectorStore.getInstance();
  private embeddingService = EmbeddingService.getInstance();

  private constructor() {}

  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * Stores a new memory experience in the Vector Database
   */
  public async storeExperience(params: {
    type: MemoryType;
    title: string;
    task: string;
    trigger?: string;
    context?: string;
    observation?: string;
    action?: string;
    outcome?: string;
    evidence?: string;
    verificationStatus?: string;
    error?: string;
    root_cause?: string;
    correction?: string;
    prevention?: string;
    general_lesson?: string;
    
    agent_error?: boolean;
    candidate_generated?: boolean;
    evaluation_executed?: boolean;
    reusable_lesson?: boolean;

    confidence?: number;
    applicability?: number;
    tags?: string[];
    tools?: string[];
  }): Promise<string> {
    try {
      const memoryId = uuidv4();
      
      const record: MemoryRecord = {
        id: memoryId,
        type: params.type,
        title: params.title,
        task: params.task,
        content: params.general_lesson || params.observation || params.error || params.action || '',
        confidence: params.confidence ?? 0.5,
        applicability: params.applicability ?? 1.0,
        status: 'active',
        metadata: {
          taskType: 'general',
          environment: process.platform,
          createdAt: Date.now(),
          successCount: 0,
          failureCount: 0,
          source: 'user',
          tags: params.tags || [],
          tools: params.tools || []
        }
      };

      if (params.trigger !== undefined) record.trigger = params.trigger;
      if (params.context !== undefined) record.context = params.context;
      if (params.observation !== undefined) record.observation = params.observation;
      if (params.action !== undefined) record.action = params.action;
      if (params.outcome !== undefined) record.outcome = params.outcome;
      if (params.evidence !== undefined) record.evidence = params.evidence;
      if (params.verificationStatus !== undefined) record.verificationStatus = params.verificationStatus;
      
      // Legacy fields
      if (params.error !== undefined) record.error = params.error;
      if (params.root_cause !== undefined) record.root_cause = params.root_cause;
      if (params.correction !== undefined) record.correction = params.correction;
      if (params.prevention !== undefined) record.prevention = params.prevention;
      if (params.general_lesson !== undefined) record.general_lesson = params.general_lesson;

      // Semantic execution flags
      if (params.agent_error !== undefined) record.agent_error = params.agent_error;
      if (params.candidate_generated !== undefined) record.candidate_generated = params.candidate_generated;
      if (params.evaluation_executed !== undefined) record.evaluation_executed = params.evaluation_executed;
      if (params.reusable_lesson !== undefined) record.reusable_lesson = params.reusable_lesson;

      // Create a text representation to embed
      let textToEmbed = `Task: ${params.task}\n`;
      if (params.observation) textToEmbed += `Observation: ${params.observation}\n`;
      if (params.evidence) textToEmbed += `Evidence: ${params.evidence}\n`;
      if (params.error) textToEmbed += `Error: ${params.error}\n`;
      if (params.prevention) textToEmbed += `Prevention: ${params.prevention}\n`;
      if (params.general_lesson) textToEmbed += `Lesson: ${params.general_lesson}\n`;

      const vector = await this.embeddingService.getEmbedding(textToEmbed);

      // Phase 6 & 7: Contradiction / Supersession Handling
      const similarMemories = await this.vectorStore.search(vector, 3);
      if (similarMemories && similarMemories.length > 0) {
        for (const old of similarMemories) {
          if (old.id !== memoryId && old.status !== 'superseded') {
            const similarity = old.task === params.task ? 0.9 : 0.5; // Stub for semantic similarity
            if (similarity > 0.85) {
                // Determine if contradiction exists or if old memory should be superseded
                if (
                    (old.type === 'AGENT_ERROR' && params.type === 'SUCCESSFUL_PROCEDURE') || 
                    (old.type === 'SUCCESSFUL_PROCEDURE' && params.type === 'SUCCESSFUL_PROCEDURE') ||
                    (old.type === 'mistake' as any && params.type === 'SUCCESSFUL_PROCEDURE') ||
                    (old.type === 'procedural' as any && params.type === 'SUCCESSFUL_PROCEDURE')
                ) {
                    this.logger.log(`[MemoryManager] Memory ${old.id} superseded by new evidence ${memoryId}`);
                    console.log(`\n[ContradictionResolver]\nOld memory ${old.id} marked as SUPERSEDED by ${memoryId}\n`);
                    old.status = 'superseded';
                    if (!old.metadata) old.metadata = { taskType: 'general', successCount: 0, failureCount: 0, createdAt: Date.now(), source: 'user' };
                    old.metadata.supersededBy = memoryId;
                    
                    // Re-store old memory with superseded status
                    await this.vectorStore.store(old, await this.embeddingService.getEmbedding(old.task));
                }
            }
          }
        }
      }

      await this.vectorStore.store(record, vector);
      
      this.logger.log(`[MemoryManager] Created new memory ${memoryId} (${params.type})`);
      console.log(`\n[MemoryStore]\nCreated memory: ${params.type}_${memoryId.substring(0, 5)}\n`);
      return memoryId;
    } catch (err) {
      this.logger.error('[MemoryManager] Failed to store experience', err);
      return '';
    }
  }

  /**
   * Updates feedback on an existing memory
   */
  public async updateFeedback(memoryId: string, wasHelpful: boolean): Promise<void> {
    try {
      const record = await this.vectorStore.get(memoryId);
      if (!record) return;

      if (!record.metadata) record.metadata = { taskType: 'general', successCount: 0, failureCount: 0, createdAt: Date.now(), source: 'user' };

      const oldConfidence = record.confidence.toFixed(2);
      if (wasHelpful) {
        record.metadata.successCount += 1;
        record.confidence = Math.min(1.0, record.confidence + 0.1);
        console.log(`\n[MemoryStore] Feedback: VERIFIED SUCCESS`);
        if (record.status === 'suppressed' && record.confidence >= 0.2) {
          record.status = 'active';
        }
      } else {
        record.metadata.failureCount += 1;
        record.confidence = Math.max(0.0, record.confidence - 0.2);
        console.log(`\n[MemoryStore] Feedback: FAILURE REPORTED`);
        
        if (record.confidence < 0.2) {
          record.status = 'suppressed';
          this.logger.log(`[MemoryManager] Memory ${memoryId} suppressed due to low confidence.`);
          console.log(`[MemoryStore] Action: SUPPRESSED due to low confidence`);
        }
      }
      
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
      const telemetry = SelfLearningTelemetry.getInstance(workspaceRoot);
      telemetry.logMemoryOutcome(wasHelpful, !wasHelpful);

      console.log(`[MemoryStore] Confidence updated: ${oldConfidence} -> ${record.confidence.toFixed(2)}\n`);

      record.metadata.lastVerifiedAt = Date.now();
      
      // Re-embed and store
      let textToEmbed = `Task: ${record.task}\n`;
      if (record.error) textToEmbed += `Error: ${record.error}\n`;
      if (record.prevention) textToEmbed += `Prevention: ${record.prevention}\n`;
      
      const vector = await this.embeddingService.getEmbedding(textToEmbed);
      await this.vectorStore.store(record, vector);

    } catch (err) {
      this.logger.error(`[MemoryManager] Failed to update feedback for ${memoryId}`, err);
    }
  }
}
