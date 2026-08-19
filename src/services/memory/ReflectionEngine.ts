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
        // Automatically extract a mistake rule
        const mistakeTitle = `Failed execution: ${toolUsed || 'Task'}`;
        const rootCause = `Encountered error: ${resultOrError.substring(0, 100)}`;
        const prevention = `Verify inputs to avoid error: ${resultOrError.substring(0, 50)}`;

        await this.memoryManager.storeExperience({
          type: 'mistake',
          title: mistakeTitle,
          task: taskDescription,
          error: resultOrError,
          root_cause: rootCause,
          prevention: prevention,
          confidence: 0.6,
          tags: ['auto-generated', 'mistake']
        });
      } else {
        // If it succeeded, check if it's worth storing
        if (taskDescription.length > 30) {
          await this.memoryManager.storeExperience({
            type: 'procedural',
            title: `Successful Task: ${taskDescription.substring(0, 30)}`,
            task: taskDescription,
            result: resultOrError,
            general_lesson: `Successfully completed using standard approach.`,
            confidence: 0.7,
            tags: ['auto-generated', 'success']
          });
        }
      }
    } catch (err) {
      this.logger.error('[ReflectionEngine] Error during evaluation', err);
    }
  }
}
