import { TrajectoryRecorder } from './trajectoryRecorder';
import { SkillRegistry } from './skillRegistry';
import { EvaluatorFactory } from './evaluator';
import { Logger } from '../../utils/logger';

export interface TrainingSuggestion {
    skillName: string;
    version: number;
    failedTasksCount: number;
    recentFailures: string[];
}

export class AutoTrainer {
    private static instance: AutoTrainer;
    private recorder: TrajectoryRecorder;
    private registry: SkillRegistry;
    private logger = Logger.getInstance();
    
    private readonly FAILURE_THRESHOLD = 5;

    private constructor(workspaceRoot: string) {
        this.recorder = TrajectoryRecorder.getInstance(workspaceRoot);
        this.registry = SkillRegistry.getInstance(workspaceRoot);
    }

    public static getInstance(workspaceRoot: string): AutoTrainer {
        if (!AutoTrainer.instance) {
            AutoTrainer.instance = new AutoTrainer(workspaceRoot);
        }
        return AutoTrainer.instance;
    }

    /**
     * Analyzes recent trajectories to suggest skills that might need optimization.
     */
    public async checkSuggestions(): Promise<TrainingSuggestion[]> {
        const trajectories = this.recorder.getTrajectories();
        const suggestions: TrainingSuggestion[] = [];
        const evaluator = EvaluatorFactory.getEvaluator();

        const activeSkills = this.registry.listSkills();

        for (const skillName of activeSkills) {
            const skill = this.registry.getBestSkill(skillName);
            if (!skill) continue;

            const currentVersion = skill.metadata.version;
            
            // Filter trajectories for the current version of this skill
            const skillTrajectories = trajectories.filter(t => t.skill === skillName && t.skillVersion === currentVersion);
            
            // Identify failures
            const evalResults = await Promise.all(skillTrajectories.map(t => evaluator.evaluate(t)));
            const failures = skillTrajectories.filter((_, i) => !skillTrajectories[i].success || evalResults[i].score < 1.0);

            if (failures.length >= this.FAILURE_THRESHOLD) {
                // Sort by timestamp descending
                failures.sort((a, b) => b.timestamp - a.timestamp);
                
                suggestions.push({
                    skillName,
                    version: currentVersion,
                    failedTasksCount: failures.length,
                    recentFailures: failures.slice(0, 3).map(f => f.task)
                });
            }
        }

        if (suggestions.length > 0) {
            this.logger.log(`[AutoTrainer] Suggested training for skills: ${suggestions.map(s => s.skillName).join(', ')}`);
        }

        return suggestions;
    }
}
