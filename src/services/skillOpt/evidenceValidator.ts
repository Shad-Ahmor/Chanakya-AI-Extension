import { Trajectory } from './trajectoryRecorder';

export type EvidenceStatus = 'VERIFIED' | 'UNVERIFIED' | 'FRAUD_DETECTED';

export interface EvidenceValidationResult {
    status: EvidenceStatus;
    reason: string;
}

export class EvidenceValidator {
    private static instance: EvidenceValidator;

    private constructor() {}

    public static getInstance(): EvidenceValidator {
        if (!EvidenceValidator.instance) {
            EvidenceValidator.instance = new EvidenceValidator();
        }
        return EvidenceValidator.instance;
    }

    /**
     * Validates if the success claim is actually backed by executed tools.
     * @param trajectory The historical trajectory containing actual tool calls and results.
     */
    public validateEvidence(trajectory: Trajectory): EvidenceValidationResult {
        // If trajectory isn't marked as success, no need to validate false claims of success
        if (!trajectory.success) {
            return {
                status: 'VERIFIED',
                reason: 'No explicit verifiable claims made, or just general failure'
            };
        }

        let testingFound = false;
        let buildFound = false;
        let testingSuccess = false;
        let buildSuccess = false;

        for (const tc of trajectory.toolCalls) {
            if (tc.toolName === 'run_command' || tc.toolName === 'run_terminal_command') {
                const cmd = JSON.stringify(tc.args).toLowerCase();
                const output = (tc.result || '').toLowerCase();
                
                if (cmd.includes('npm test') || cmd.includes('jest') || cmd.includes('vitest') || cmd.includes('pytest')) {
                    testingFound = true;
                    if (!output.includes('fail') && !output.includes('error') && output.includes('pass')) {
                        testingSuccess = true;
                    }
                }
                
                if (cmd.includes('npm run build') || cmd.includes('tsc') || cmd.includes('webpack') || cmd.includes('vite build')) {
                    buildFound = true;
                    if (!output.includes('err') && !output.includes('fail')) {
                        buildSuccess = true;
                    }
                }
            }
        }

        if (!testingFound && !buildFound) {
            return {
                status: 'FRAUD_DETECTED',
                reason: 'LLM claimed success, but no testing or build commands were executed.'
            };
        }

        if (testingFound && !testingSuccess) {
            return {
                status: 'UNVERIFIED',
                reason: 'Tests were run, but output indicates failure.'
            };
        }

        if (buildFound && !buildSuccess) {
            return {
                status: 'UNVERIFIED',
                reason: 'Build was run, but output indicates failure.'
            };
        }

        return {
            status: 'VERIFIED',
            reason: 'Claims are supported by trajectory evidence.'
        };
    }
}
