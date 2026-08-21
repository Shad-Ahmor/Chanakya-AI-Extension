"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanTracker = void 0;
const events_1 = require("events");
const logger_1 = require("../utils/logger");
class PlanTracker {
    static instance;
    logger = logger_1.Logger.getInstance();
    events = new events_1.EventEmitter();
    activePlan = null;
    static getInstance() {
        if (!PlanTracker.instance) {
            PlanTracker.instance = new PlanTracker();
        }
        return PlanTracker.instance;
    }
    /**
     * Initializes or replaces the active plan (like DeepSeek Harness todo_write / plan_entry)
     */
    setPlan(title, tasks) {
        const planId = `plan_${Date.now()}`;
        const formattedTasks = tasks.map((t, idx) => ({
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
    updateTaskStatus(taskId, status, durationMs) {
        if (!this.activePlan)
            return null;
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
                }
                else {
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
    getActivePlan() {
        return this.activePlan;
    }
    clearPlan() {
        this.activePlan = null;
        this.emitChange();
    }
    emitChange() {
        this.events.emit('planChanged', this.activePlan);
    }
}
exports.PlanTracker = PlanTracker;
//# sourceMappingURL=planTracker.js.map