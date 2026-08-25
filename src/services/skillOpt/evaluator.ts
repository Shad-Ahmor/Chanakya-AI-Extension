import { Trajectory } from './trajectoryRecorder';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { EvidenceValidator } from './evidenceValidator';

const execAsync = promisify(exec);


export interface EvaluationResult {
    success: boolean;
    score: number;
    reason: string;
}

export interface IEvaluator {
    evaluate(trajectory: Trajectory, _options?: any): Promise<EvaluationResult>;
}

export class BaseTrajectoryEvaluator implements IEvaluator {

    public async evaluate(trajectory: Trajectory, _options?: any): Promise<EvaluationResult> {
        
        const evidenceValidator = EvidenceValidator.getInstance();
        const evidenceResult = evidenceValidator.validateEvidence(trajectory);

        if (evidenceResult.status === 'FRAUD_DETECTED' || evidenceResult.status === 'UNVERIFIED') {
            return {
                success: false,
                score: 0,
                reason: `Evidence Validation Failed: ${evidenceResult.reason}`
            };
        }

        let score = 0;
        let reasons: string[] = [];

        // 1. Task Completion (Weight: 50%)
        if (trajectory.success) {
            score += 50;
            reasons.push("Task completed successfully.");
        } else {
            reasons.push("Task failed.");
        }

        // 2. Tool Calls (Weight: up to 50%)
        let toolScore = 0;
        if (trajectory.toolCalls.length > 0) {
            let successCount = 0;
            let errorCount = 0;

            for (const call of trajectory.toolCalls) {
                if (call.success) {
                    successCount++;
                } else {
                    errorCount++;
                }
            }

            // Ratio of successful tools
            const toolSuccessRatio = successCount / trajectory.toolCalls.length;
            toolScore = toolSuccessRatio * 50;
            
            if (errorCount > 0) {
                reasons.push(`${errorCount} MCP tool call(s) failed.`);
                // Deduct flat penalty for errors
                toolScore -= (errorCount * 5);
            }
        } else {
            // If no tools were called but task succeeded, give full tool score.
            if (trajectory.success) {
                toolScore = 50;
            }
        }

        // 3. Retries Penalty
        if (trajectory.retries > 0) {
            const retryPenalty = trajectory.retries * 10;
            toolScore -= retryPenalty;
            reasons.push(`Required ${trajectory.retries} retries.`);
        }

        score += Math.max(0, toolScore); // Don't let tool score drop below 0

        // Clamp total score
        score = Math.max(0, Math.min(100, score));

        // Normalize to 0.0 - 1.0 range
        const normalizedScore = Number((score / 100).toFixed(2));

        const result: EvaluationResult = {
            success: normalizedScore >= 0.7 && trajectory.success,
            score: normalizedScore,
            reason: reasons.join(' ').trim()
        };

        return result;
    }
}


export class TechnologyAwareEvaluator extends BaseTrajectoryEvaluator {
    public override async evaluate(trajectory: Trajectory, _options?: any): Promise<EvaluationResult> {
        const baseResult = await super.evaluate(trajectory, _options);
        let score = baseResult.score * 100;
        let reasons = [baseResult.reason];

        const workspace = _options?.customWorkspace;
        if (!workspace || !fs.existsSync(workspace)) {
            return baseResult;
        }

        try {
            const packageJsonPath = path.join(workspace, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                reasons.push('Detected Node.js project.');
                try {
                    await execAsync('npm install', { cwd: workspace });
                    reasons.push('npm install succeeded.');
                    
                    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                    if (packageJson.scripts && packageJson.scripts.build) {
                        await execAsync('npm run build', { cwd: workspace });
                        score += 20;
                        reasons.push('npm run build succeeded.');
                    }
                    if (packageJson.scripts && packageJson.scripts.test) {
                        await execAsync('npm run test', { cwd: workspace });
                        score += 20;
                        reasons.push('npm run test succeeded.');
                    }
                } catch (e: any) {
                    score -= 30;
                    reasons.push(`Command failed: ${e.message}`);
                }
            }
        } catch (err: any) {
            reasons.push(`Tech evaluation error: ${err.message}`);
        }

        score = Math.max(0, Math.min(100, score));
        const normalizedScore = Number((score / 100).toFixed(2));

        return {
            success: normalizedScore >= 0.7 && baseResult.success,
            score: normalizedScore,
            reason: reasons.join(' ').trim()
        };
    }
}

export class EvaluatorFactory {
    public static getEvaluator(): IEvaluator {
        return new TechnologyAwareEvaluator();
    }
}
