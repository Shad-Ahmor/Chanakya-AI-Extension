import { TaskArtifact } from './types';
import { Logger } from '../../utils/logger';

export class PlanVerifier {
    private readonly logger = Logger.getInstance();

    /**
     * Verifies that the plan is structurally sound, contains no obvious circular
     * dependencies, and has actionable steps.
     * @returns Array of error messages. Empty array means plan is valid.
     */
    public verify(artifact: TaskArtifact): string[] {
        this.logger.log(`[PlanVerifier] Verifying plan for ${artifact.taskId}`);
        const errors: string[] = [];

        if (artifact.requirements.length === 0) {
            errors.push('Plan must have at least one requirement.');
        }

        if (artifact.phases.length === 0) {
            errors.push('Plan must have at least one execution phase.');
        }

        const stepIds = new Set<string>();
        
        for (const phase of artifact.phases) {
            if (phase.steps.length === 0) {
                errors.push(`Phase ${phase.phaseId} has no steps.`);
            }

            for (const step of phase.steps) {
                if (!step.objective || step.objective.trim() === '') {
                    errors.push(`Step ${step.stepId} has an empty objective.`);
                }

                if (stepIds.has(step.stepId)) {
                    errors.push(`Duplicate step ID found: ${step.stepId}`);
                }
                stepIds.add(step.stepId);

                // Verify dependencies exist
                for (const dep of step.dependencies) {
                    if (!stepIds.has(dep)) {
                        errors.push(`Step ${step.stepId} depends on unknown or future step ${dep}`);
                    }
                }

                if (!step.verificationMethod || step.verificationMethod.trim() === '') {
                    errors.push(`Step ${step.stepId} is missing a verification method.`);
                }

                if (step.risk === 'HIGH' && (!step.verificationMethod || step.verificationMethod.length < 10)) {
                    errors.push(`Step ${step.stepId} is HIGH risk but lacks a robust verification method or rollback strategy.`);
                }
            }
        }

        return errors;
    }
}
