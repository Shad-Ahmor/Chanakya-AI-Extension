import re

with open("src/services/skillOpt/evaluator.ts", "r") as f:
    code = f.read()

# Remove the appended block
code = code.split("import { Trajectory } from './trajectoryRecorder';\nimport * as fs from 'fs';")[0]

# Add imports at the top
new_imports = """import { Trajectory } from './trajectoryRecorder';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
"""
code = code.replace("import { Trajectory } from './trajectoryRecorder';", new_imports)

# Add TechnologyAwareEvaluator before EvaluatorFactory
eval_class = """
export class TechnologyAwareEvaluator extends BaseTrajectoryEvaluator {
    public async evaluate(trajectory: Trajectory, _options?: any): Promise<EvaluationResult> {
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
"""

code = code.replace("export class EvaluatorFactory", eval_class + "\nexport class EvaluatorFactory")

# Make EvaluatorFactory return TechnologyAwareEvaluator
code = code.replace("return new BaseTrajectoryEvaluator();", "return new TechnologyAwareEvaluator();")

with open("src/services/skillOpt/evaluator.ts", "w") as f:
    f.write(code)

