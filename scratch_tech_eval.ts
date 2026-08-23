import { Trajectory } from './trajectoryRecorder';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseTrajectoryEvaluator, EvaluationResult } from './evaluator';

const execAsync = promisify(exec);

export class TechnologyAwareEvaluator extends BaseTrajectoryEvaluator {
    public async evaluate(trajectory: Trajectory, options?: { customWorkspace?: string }): Promise<EvaluationResult> {
        // Base evaluation first
        const baseResult = await super.evaluate(trajectory, options);
        let score = baseResult.score * 100;
        let reasons = [baseResult.reason];

        const workspace = options?.customWorkspace;
        if (!workspace || !fs.existsSync(workspace)) {
            return baseResult;
        }

        try {
            // Check for package.json
            const packageJsonPath = path.join(workspace, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                reasons.push('Detected Node.js project.');
                try {
                    // Try to install and build/test
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

            // Could detect Python, etc.
        } catch (err: any) {
            reasons.push(`Tech evaluation error: ${err.message}`);
        }

        // Clamp total score
        score = Math.max(0, Math.min(100, score));
        const normalizedScore = Number((score / 100).toFixed(2));

        return {
            success: normalizedScore >= 0.7 && baseResult.success,
            score: normalizedScore,
            reason: reasons.join(' ').trim()
        };
    }
}
