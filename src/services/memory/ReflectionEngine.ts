import { Logger } from '../../utils/logger';
import { MemoryManager } from './MemoryManager';

export class ReflectionEngine {
  private static instance: ReflectionEngine;
  private logger = Logger.getInstance();
  private memoryManager = MemoryManager.getInstance();

  private constructor() {}

  public static getInstance(): ReflectionEngine {
    if (!ReflectionEngine.instance) {
      ReflectionEngine.instance = new ReflectionEngine();
    }
    return ReflectionEngine.instance;
  }

  /**
   * For the MVP, we simulate reflection by simply extracting basic fields from the error message.
   * In a full implementation, this would call the LLM to perform Root Cause Analysis.
   * Since LLMEngine streamChat is heavy and async, doing it via a simpler heuristic first is safer,
   * but we can upgrade this to a hidden LLM call.
   */
  public async evaluateTask(
    taskDescription: string,
    success: boolean,
    resultOrError: string,
    toolUsed?: string
  ): Promise<void> {
    try {
      this.logger.log(`[ReflectionEngine] Evaluating task success=${success}`);
      
      if (!success) {
        let memoryType: any = 'AGENT_ERROR';
        let prevention = `Verify inputs to avoid error: ${resultOrError.substring(0, 50)}`;
        
        // Better heuristic classification
        const errorLower = resultOrError.toLowerCase();
        let agentError = true;
        let candidateGenerated = true;
        let evaluationExecuted = true;
        
        if (errorLower.includes('not found') || errorLower.includes('enoent') || errorLower.includes('does not exist')) {
           memoryType = 'TASK_REPOSITORY_MISMATCH';
           prevention = 'Verify target existence before modification.';
           agentError = false;
           candidateGenerated = false;
           evaluationExecuted = false;
        } else if (errorLower.includes('permission denied') || errorLower.includes('eacces')) {
           memoryType = 'ENVIRONMENT_FAILURE';
           agentError = false;
           evaluationExecuted = false;
        } else if (toolUsed) {
           memoryType = 'TOOL_FAILURE';
           agentError = false;
           candidateGenerated = false;
           evaluationExecuted = false;
        }

        const mistakeTitle = `Failed execution: ${toolUsed || 'Task'}`;
        const rootCause = `Encountered error: ${resultOrError.substring(0, 100)}`;
        
        console.log(`\n[MistakeAnalyzer]\nCategory: ${memoryType}\nRootCause: ${rootCause}\nPrevention: ${prevention}\n`);

        await this.memoryManager.storeExperience({
          type: memoryType,
          title: mistakeTitle,
          task: taskDescription,
          outcome: 'NOT_APPLICABLE',
          root_cause: rootCause,
          observation: resultOrError,
          evidence: resultOrError.substring(0, 500),
          verificationStatus: 'FAILED',
          prevention: prevention,
          agent_error: agentError,
          candidate_generated: candidateGenerated,
          evaluation_executed: evaluationExecuted,
          reusable_lesson: true,
          confidence: 0.9,
          tags: ['auto-generated', 'failure']
        });
      } else {
        // If it succeeded, check if it's worth storing
        if (taskDescription.length > 30) {
          await this.memoryManager.storeExperience({
            type: 'SUCCESSFUL_PROCEDURE',
            title: `Successful Task: ${taskDescription.substring(0, 30)}`,
            task: taskDescription,
            outcome: resultOrError,
            general_lesson: `Successfully completed using standard approach.`,
            verificationStatus: 'VERIFIED_SUCCESS',
            confidence: 0.7,
            tags: ['auto-generated', 'success']
          });
        }
      }
    } catch (err) {
      this.logger.error('[ReflectionEngine] Error during evaluation', err);
    }
  }

  /**
   * Phase 6: Extract successful sequence into procedural strategy
   */
  public async extractProceduralStrategy(taskDescription: string, toolSequence: string[]): Promise<void> {
    try {
      if (toolSequence.length === 0) return;
      
      const sequenceStr = toolSequence.join(' → ');
      let proceduralRule = `Execute in this order: ${sequenceStr}.`;
      
      // Heuristic extraction for common patterns (Phase 6 example)
      if (toolSequence.includes('workspace_search') && toolSequence.includes('fs_read') && toolSequence.includes('replace_file_content')) {
         proceduralRule = 'For component modifications: discover the component, inspect dependencies, make the smallest change, run the relevant test, then verify.';
      }

      console.log(`\n[ProceduralExtraction]\nTask: ${taskDescription}\nStrategy: ${sequenceStr}\nRule: ${proceduralRule}\n`);

      await this.memoryManager.storeExperience({
        type: 'SUCCESSFUL_PROCEDURE',
        title: `Procedural Strategy: ${taskDescription.substring(0, 30)}`,
        task: taskDescription,
        general_lesson: proceduralRule,
        tools: toolSequence,
        confidence: 0.7,
        tags: ['procedural', 'strategy']
      });
    } catch (err) {
      this.logger.error('[ReflectionEngine] Error during procedural extraction', err);
    }
  }
}
