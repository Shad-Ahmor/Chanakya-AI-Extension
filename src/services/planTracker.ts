import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';

export interface PlanTaskItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  description?: string | undefined;
  dependencies?: string[] | undefined;
  subtasks?: { id: string; title: string; completed: boolean }[] | undefined;
  durationMs?: number | undefined;
}

export interface PlanState {
  planId: string;
  title: string;
  tasks: PlanTaskItem[];
  currentTaskId: string | null;
  overallProgress: number; // 0 to 100
  updatedAt: number;
}

export class PlanTracker {
  private static instance: PlanTracker;
  private readonly logger = Logger.getInstance();
  public readonly events = new EventEmitter();

  private activePlan: PlanState | null = null;

  public static getInstance(): PlanTracker {
    if (!PlanTracker.instance) {
      PlanTracker.instance = new PlanTracker();
    }
    return PlanTracker.instance;
  }

  /**
   * Initializes or replaces the active plan (like DeepSeek Harness todo_write / plan_entry)
   */
  public setPlan(title: string, tasks: { id?: string; title: string; description?: string }[]): PlanState {
    const planId = `plan_${Date.now()}`;
    const formattedTasks: PlanTaskItem[] = tasks.map((t, idx) => ({
      id: t.id || `task_${idx + 1}`,
      title: t.title,
      description: t.description,
      status: idx === 0 ? 'in_progress' : 'pending'
    }));

    this.activePlan = {
      planId,
      title,
      tasks: formattedTasks,
      currentTaskId: formattedTasks.length > 0 ? formattedTasks[0].id : null,
      overallProgress: 0,
      updatedAt: Date.now()
    };

    this.logger.log(`[PlanTracker] Initialized plan "${title}" with ${formattedTasks.length} tasks`);
    this.emitChange();
    return this.activePlan;
  }

  /**
   * Updates a task status (e.g. task_1 -> completed)
   */
  public updateTaskStatus(taskId: string, status: PlanTaskItem['status'], durationMs?: number): PlanState | null {
    if (!this.activePlan) return null;

    const taskIndex = this.activePlan.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex >= 0) {
      this.activePlan.tasks[taskIndex].status = status;
      if (durationMs) {
        this.activePlan.tasks[taskIndex].durationMs = durationMs;
      }

      // Auto-advance to next pending task if completed
      if (status === 'completed') {
        const nextPending = this.activePlan.tasks.find((t) => t.status === 'pending');
        if (nextPending) {
          nextPending.status = 'in_progress';
          this.activePlan.currentTaskId = nextPending.id;
        } else {
          this.activePlan.currentTaskId = null;
        }
      }

      // Recalculate progress
      const completedCount = this.activePlan.tasks.filter((t) => t.status === 'completed').length;
      this.activePlan.overallProgress = Math.round((completedCount / this.activePlan.tasks.length) * 100);
      this.activePlan.updatedAt = Date.now();

      this.logger.log(`[PlanTracker] Task "${taskId}" status changed to ${status} (${this.activePlan.overallProgress}% total)`);
      this.emitChange();
    }

    return this.activePlan;
  }

  public getActivePlan(): PlanState | null {
    return this.activePlan;
  }

  public clearPlan(): void {
    this.activePlan = null;
    this.emitChange();
  }

  private emitChange(): void {
    this.events.emit('planChanged', this.activePlan);
  }
}
