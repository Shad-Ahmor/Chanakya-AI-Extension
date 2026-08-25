import { SkillRegistry } from './skillRegistry';
import { TrajectoryRecorder } from './trajectoryRecorder';
import { EvaluatorFactory } from './evaluator';
import { ReflectionEngine } from './reflectionEngine';
import { CandidateGenerator } from './candidateGenerator';
import { ValidationGate } from './validationGate';
import { MemoryManager } from '../memory/MemoryManager';
import { Logger } from '../../utils/logger';
import { OptimizationResult } from './types';
import { TaskApplicabilityValidator } from './taskApplicabilityValidator';

export class SkillOptService {
    private static instance: SkillOptService;
    private registry: SkillRegistry;
    private recorder: TrajectoryRecorder;
    private reflection: ReflectionEngine;
    private generator: CandidateGenerator;
    private validationGate: ValidationGate;
    private logger = Logger.getInstance();

    private constructor(workspaceRoot: string) {
        this.registry = SkillRegistry.getInstance(workspaceRoot);
        this.recorder = TrajectoryRecorder.getInstance(workspaceRoot);
        this.reflection = ReflectionEngine.getInstance();
        this.generator = CandidateGenerator.getInstance(workspaceRoot);
        this.validationGate = ValidationGate.getInstance();
    }

    public static getInstance(workspaceRoot: string): SkillOptService {
        if (!SkillOptService.instance) {
            SkillOptService.instance = new SkillOptService(workspaceRoot);
        }
        return SkillOptService.instance;
    }

    public static resetInstance(): void {
        (SkillOptService as any).instance = undefined;
    }

    /**
     * Executes the complete optimization loop.
     * @param skillName The name of the skill category to optimize.
     * @param validationRunner A callback that runs benchmark tests on the new candidate content and returns its score.
     */
    public async optimize(
        skillName: string, 
        validationRunner: (candidateContent: string, reflectionResult: any, trajectories: any[], baselineScore: number) => Promise<number>
    ): Promise<OptimizationResult> {
        // 1. Load current best skill
        const bestSkill = this.registry.getBestSkill(skillName);
        if (!bestSkill) {
            throw new Error(`Skill ${skillName} not found or has no best version.`);
        }

        // 2. Load historical trajectories
        const allTrajectories = this.recorder.getTrajectories();
        const skillTrajectories = allTrajectories.filter(t => t.skill === skillName && t.skillVersion === bestSkill.metadata.version);
        
        if (skillTrajectories.length === 0) {
            throw new Error(`No trajectories found for skill ${skillName} (version ${bestSkill.metadata.version}).`);
        }

        // 3. Evaluate relevant trajectories to get baseline score
        const evaluator = EvaluatorFactory.getEvaluator();
        let totalScore = 0;
        for (const t of skillTrajectories) {
            totalScore += (await evaluator.evaluate(t)).score;
        }
        const scoreBefore = totalScore / skillTrajectories.length;
        
        // 3.5 Check Task Applicability before generating candidates
        const latestTrajectory = skillTrajectories[skillTrajectories.length - 1];
        const validator = TaskApplicabilityValidator.getInstance();
        const applicability = await validator.validate(latestTrajectory.task || skillName, latestTrajectory);

        if (applicability.applicable !== 'YES') {
            this.logger.log(`[SkillOpt] Task applicability validation failed: ${applicability.applicable} - ${applicability.reasonCode}`);
            return {
                decision: 'not_evaluated',
                skill: skillName,
                reason: applicability.reason,
                task: {
                    status: applicability.applicable === 'NO' ? 'TASK_NOT_APPLICABLE' : applicability.applicable === 'UNCERTAIN' ? 'TASK_NEEDS_CLARIFICATION' : 'TASK_BLOCKED',
                    reason: applicability.reason,
                    reasonCode: applicability.reasonCode,
                    evidence: applicability.evidence
                },
                candidate: {
                    status: 'CANDIDATE_NOT_CREATED',
                    candidateId: null,
                    generated: false,
                    applied: false
                },
                evaluation: {
                    status: 'EVALUATION_NOT_RUN',
                    score: 0,
                    baselineScore: scoreBefore,
                    candidateScore: 0,
                    testsPassed: false
                },
                optimization: {
                    decision: 'NOT_EVALUATED',
                    reason: applicability.reason
                }
            };
        }

        // 4. Ask ReflectionEngine for repeated problems
        const reflectionResult = await this.reflection.reflect(skillTrajectories);
        if (reflectionResult.improvements.length === 0) {
             throw new Error('Optimization halted: No behavioral improvements proposed by reflection.');
        }

        // 5. Generate candidate skill
        let candidateResult: any;
        try {
            candidateResult = await this.generator.generateCandidate(skillName, bestSkill.metadata.version, bestSkill.content, reflectionResult, []);
            if (!candidateResult || !candidateResult.candidates || candidateResult.candidates.length === 0 || candidateResult.candidates[0].edits.length === 0) {
                throw new Error('Optimization halted: No edits generated for the candidate.');
            }
        } catch (e: any) {
            this.logger.log(`[SkillOpt] Candidate generation failed: ${e.message}`);
            return {
                decision: 'not_evaluated',
                skill: skillName,
                reason: e.message,
                task: {
                    status: 'TASK_FAILED',
                    reason: e.message,
                    reasonCode: 'CANDIDATE_GENERATION_FAILED',
                    evidence: []
                },
                candidate: {
                    status: 'CANDIDATE_GENERATION_FAILED',
                    candidateId: null,
                    generated: false,
                    applied: false
                },
                evaluation: {
                    status: 'EVALUATION_NOT_RUN',
                    score: 0,
                    baselineScore: scoreBefore,
                    candidateScore: 0,
                    testsPassed: false
                },
                optimization: {
                    decision: 'NOT_EVALUATED',
                    reason: 'Candidate generation failed'
                }
            };
        }
        
        // Save candidate to registry as draft
        const candidateSkill = this.registry.createSkillVersion(
            skillName, 
            candidateResult.candidates[0].content, 
            bestSkill.metadata.version, 
            'Candidate generated by SkillOpt'
        );
        candidateSkill.metadata.status = 'draft';
        this.registry.saveSkillVersion(skillName, candidateSkill);

        // 6. Validate candidate
        this.logger.log(`Validating candidate v${candidateSkill.metadata.version} for ${skillName}...`);
        let scoreAfter = 0;
        try {
            scoreAfter = await validationRunner(candidateResult.candidates[0].content, reflectionResult, skillTrajectories, scoreBefore);
        } catch (e: any) {
            this.logger.log(`[SkillOpt] Evaluation failed: ${e.message}`);
            candidateSkill.metadata.status = 'archived';
            candidateSkill.metadata.changeDescription = `Evaluation crashed: ${e.message}`;
            this.registry.saveSkillVersion(skillName, candidateSkill);

            return {
                decision: 'not_evaluated',
                skill: skillName,
                reason: e.message,
                task: {
                    status: 'TASK_FAILED',
                    reason: e.message,
                    reasonCode: 'EVALUATION_FAILED',
                    evidence: []
                },
                candidate: {
                    status: 'CANDIDATE_APPLIED',
                    candidateId: candidateSkill.metadata.version.toString(),
                    generated: true,
                    applied: true
                },
                evaluation: {
                    status: 'EVALUATION_FAILED',
                    score: 0,
                    baselineScore: scoreBefore,
                    candidateScore: 0,
                    testsPassed: false
                },
                optimization: {
                    decision: 'NOT_EVALUATED',
                    reason: 'Evaluation crashed or threw an error'
                }
            };
        }
        // 7 & 8. Validation Gate (Accept or Reject)
        const decision = this.validationGate.evaluateDecision(scoreBefore, scoreAfter);

        if (decision.decision === 'accepted') {
            // Promote candidate
            this.registry.promoteSkill(skillName, candidateSkill.metadata.version);
            this.logger.log(`Optimization ACCEPTED: Promoted ${skillName} to v${candidateSkill.metadata.version}`);
            
            // Phase 7: Store SkillOpt Learning (Accepted)
            MemoryManager.getInstance().storeExperience({
                type: 'SUCCESSFUL_PROCEDURE',
                title: `SkillOpt Accepted: ${skillName}`,
                task: `Optimize skill ${skillName}`,
                general_lesson: `Optimization ACCEPTED: ${decision.reason}. Score improved from ${scoreBefore} to ${scoreAfter}.`,
                confidence: 0.8,
                tags: ['skillopt', 'accepted', skillName]
            });

        } else {
            // Reject candidate
            candidateSkill.metadata.status = 'archived';
            candidateSkill.metadata.changeDescription = `Rejected: ${decision.reason}`;
            this.registry.saveSkillVersion(skillName, candidateSkill);
            
            // Phase 7: Store SkillOpt Learning (Rejected)
            MemoryManager.getInstance().storeExperience({
                type: 'EVALUATION_FAILURE',
                title: `SkillOpt Rejected: ${skillName}`,
                task: `Optimize skill ${skillName}`,
                general_lesson: `This exact approach previously underperformed in similar context: Score lower than baseline (${scoreBefore} -> ${scoreAfter}). Avoid candidate changes: ${candidateResult.candidates[0].edits.map((e: any) => e.operation).join(', ')}`,
                confidence: 0.8,
                tags: ['skillopt', 'rejected', skillName]
            });
        }

        // 9. Return Optimization Report
        return {
            skill: skillName,
            previousVersion: bestSkill.metadata.version,
            candidateVersion: candidateSkill.metadata.version,
            scoreBefore: scoreBefore,
            scoreAfter: scoreAfter,
            improvement: decision.improvement,
            decision: decision.decision as any,
            changes: candidateResult.candidates[0].edits,
            reason: decision.reason,
            task: {
                status: 'TASK_COMPLETED',
                reason: 'Task executed and evaluated successfully',
                reasonCode: 'CANDIDATE_EVALUATED' as any
            },
            candidate: {
                status: decision.decision === 'accepted' ? 'CANDIDATE_ACCEPTED' : 'CANDIDATE_REJECTED',
                candidateId: candidateSkill.metadata.version.toString(),
                generated: true,
                applied: true
            },
            evaluation: {
                status: 'EVALUATION_PASSED',
                score: scoreAfter,
                baselineScore: scoreBefore,
                candidateScore: scoreAfter,
                testsPassed: true
            },
            optimization: {
                decision: decision.decision === 'accepted' ? 'ACCEPTED' : 'REJECTED',
                reason: decision.reason
            }
        };
    }
}
