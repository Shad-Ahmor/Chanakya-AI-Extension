
export type PolicyDecision = 'ALLOW' | 'BLOCK' | 'REQUIRES_AUTHORIZATION';

export interface PolicyEvaluationResult {
    decision: PolicyDecision;
    reasonCode: string;
    reason: string;
}

export class ChangePolicyGate {
    private static instance: ChangePolicyGate;

    private constructor() {}

    public static getInstance(): ChangePolicyGate {
        if (!ChangePolicyGate.instance) {
            ChangePolicyGate.instance = new ChangePolicyGate();
        }
        return ChangePolicyGate.instance;
    }

    /**
     * Evaluates a task description against the strict change policy.
     * @param taskDescription The user's prompt or extracted task.
     * @param repositoryFramework The currently detected framework (e.g., 'vite', 'nextjs').
     * @param isAuthorized Whether the user explicitly authorized a major architectural change.
     */
    public evaluatePolicy(
        taskDescription: string, 
        repositoryFramework?: string,
        isAuthorized: boolean = false
    ): PolicyEvaluationResult {
        const lowerTask = taskDescription.toLowerCase();

        // 1. Destructive Operations (Family 5)
        if (
            lowerTask.includes('rm -rf') || 
            lowerTask.includes('git reset --hard') || 
            lowerTask.includes('delete file') || 
            lowerTask.includes('overwrite') || 
            lowerTask.includes('remove package') ||
            lowerTask.includes('delete config')
        ) {
            if (!isAuthorized) {
                return {
                    decision: 'BLOCK',
                    reasonCode: 'DESTRUCTIVE_OPERATION_BLOCKED',
                    reason: 'Task requests a destructive operation. Explicit authorization is required.'
                };
            }
        }

        // 2. Framework Migration (Rule 0.3)
        const frameworks = ['vite', 'next.js', 'nextjs', 'react', 'remix', 'express', 'django', 'flask'];
        let requestedFramework = '';
        for (const fw of frameworks) {
            if (lowerTask.includes(`to ${fw}`) || lowerTask.includes(`migrate to ${fw}`) || lowerTask.includes(`use ${fw} instead`)) {
                requestedFramework = fw;
                break;
            }
        }

        if (requestedFramework && repositoryFramework && requestedFramework !== repositoryFramework) {
            if (!isAuthorized) {
                return {
                    decision: 'BLOCK',
                    reasonCode: 'FRAMEWORK_MIGRATION_BLOCKED',
                    reason: `Task implies migration to ${requestedFramework}, but repository is ${repositoryFramework}. Migration must be explicitly requested and authorized.`
                };
            }
        }

        // 3. Dependency Addition without authorization (Rule 0.6)
        if (
            (lowerTask.includes('npm install') || lowerTask.includes('yarn add') || lowerTask.includes('pip install')) && 
            !isAuthorized
        ) {
            return {
                decision: 'BLOCK',
                reasonCode: 'UNAUTHORIZED_DEPENDENCY',
                reason: 'Task requires installing new dependencies. This requires explicit justification and authorization.'
            };
        }

        return {
            decision: 'ALLOW',
            reasonCode: 'POLICY_PASSED',
            reason: 'Task complies with baseline repository policies.'
        };
    }
}
