import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SkillOptService } from '../services/skillOpt/skillOptService';
import { RolloutEngine } from '../services/skillOpt/rolloutEngine';
import { Logger } from '../utils/logger';
import { BuiltInSkillSeeder } from '../services/skillOpt/builtInSkillSeeder';
import { SkillRegistry } from '../services/skillOpt/skillRegistry';
import { EvaluatorFactory } from '../services/skillOpt/evaluator';
import { TrajectoryRecorder } from '../services/skillOpt/trajectoryRecorder';

export async function runReactPilot() {
    const logger = Logger.getInstance();
    logger.log('[SkillOpt] Starting baseline');
    logger.log('[SkillOpt] Skill: react@1');

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('Pilot requires an open workspace.');
        return;
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // 1. Ensure React skill is seeded
    const registry = SkillRegistry.getInstance(workspaceRoot);
    BuiltInSkillSeeder.seedSkills(registry);

    const reactSkill = registry.getSkillCategoryMetadata('react');
    if (!reactSkill) {
        vscode.window.showErrorMessage('React skill not found. Seeder failed.');
        return;
    }

    // Prepare Sandboxes
    const sandboxRoot = path.join(workspaceRoot, '.agents', 'sandbox', 'react-pilot');
    const trainSandbox = path.join(sandboxRoot, 'train');
    const valSandbox = path.join(sandboxRoot, 'val');

    fs.mkdirSync(trainSandbox, { recursive: true });
    fs.mkdirSync(valSandbox, { recursive: true });

    // Setup train sandbox
    fs.writeFileSync(path.join(trainSandbox, 'package.json'), JSON.stringify({
        name: "react-pilot-train",
        dependencies: { "react": "^18.2.0", "react-dom": "^18.2.0" },
        scripts: { "test": "node test.js" }
    }));
    fs.writeFileSync(path.join(trainSandbox, 'App.js'), `
const React = require('react');
function App() {
    // BUG: Mutating state directly
    const [count, setCount] = React.useState(0);
    const increment = () => { count = count + 1; };
    return React.createElement('div', { onClick: increment }, count);
}
module.exports = App;
`);
    fs.writeFileSync(path.join(trainSandbox, 'test.js'), `
const assert = require('assert');
const fs = require('fs');
const content = fs.readFileSync('./App.js', 'utf8');
if (content.includes('count = count + 1')) {
    console.error('State mutation bug still exists.');
    process.exit(1);
} else {
    console.log('App looks fixed.');
    process.exit(0);
}
`);

    logger.log(`[SkillOpt] Workspace: ${trainSandbox}`);

    const trainTask = {
        id: 'react-train-001',
        description: 'The React component in App.js has a state mutation bug. Fix it by using the state setter function correctly.',
        expectedOutcome: 'The component uses setCount correctly instead of direct mutation.',
        type: 'train' as const,
        workspace: trainSandbox
    };

    const rollout = RolloutEngine.getInstance(workspaceRoot);
    const optimizer = SkillOptService.getInstance(workspaceRoot);
    const recorder = TrajectoryRecorder.getInstance(workspaceRoot);

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Running Real React Pilot Optimization Loop...",
        cancellable: false
    }, async (progress) => {
        try {
            logger.log('[SkillOpt] Starting real agent rollout');
            logger.log('[SkillOpt] LLM execution started');

            // RUN BASELINE
            await rollout.executeTask('react', 1, '', trainTask);

            const trainTrajectory = recorder.getTrajectory(trainTask.id);
            const numToolCalls = trainTrajectory ? trainTrajectory.toolCalls.length : 0;
            logger.log(`[SkillOpt] Tool calls: ${numToolCalls}`);
            
            let filesChanged = 0;
            if (trainTrajectory) {
                 filesChanged = trainTrajectory.toolCalls.filter(tc => tc.toolName === 'replace_file_content' || tc.toolName === 'write_to_file' || tc.toolName === 'run_command').length;
            }
            logger.log(`[SkillOpt] Files changed: ${filesChanged}`);

            // The optimizer will run the evaluator on the baseline itself.
            progress.report({ message: 'Analyzing trajectories and reflecting...' });

            const result = await optimizer.optimize('react', async (candidateContent, _reflectionResult, trajectories, scoreBefore) => {
                logger.log('[SkillOpt] Running evaluator');
                logger.log(`[SkillOpt] Baseline score: ${scoreBefore}`);
                logger.log('[SkillOpt] Generating candidate');
                
                // Validate the candidate
                // Setup val sandbox
                fs.writeFileSync(path.join(valSandbox, 'package.json'), JSON.stringify({
                    name: "react-pilot-val",
                    dependencies: { "react": "^18.2.0", "react-dom": "^18.2.0" },
                    scripts: { "test": "node test.js" }
                }));
                fs.writeFileSync(path.join(valSandbox, 'App.js'), `
const React = require('react');
function App() {
    const [count, setCount] = React.useState(0);
    // BUG: missing dependency
    React.useEffect(() => {
        console.log(count);
    }, []);
    return React.createElement('div', null, count);
}
module.exports = App;
`);
                fs.writeFileSync(path.join(valSandbox, 'test.js'), `
const assert = require('assert');
const fs = require('fs');
const content = fs.readFileSync('./App.js', 'utf8');
if (!content.includes('[count]')) {
    console.error('useEffect dependency bug still exists.');
    process.exit(1);
} else {
    console.log('App looks fixed.');
    process.exit(0);
}
`);

                const valTask = {
                    id: 'react-val-001',
                    description: 'The React component in App.js has a missing dependency in useEffect. Fix the dependency array.',
                    expectedOutcome: 'The component correctly includes count in the useEffect dependencies array.',
                    type: 'val' as const,
                    workspace: valSandbox
                };

                // The candidate version is usually latest + 1. It is promoted later.
                // We don't have the exact candidate version here, but we can pass 2 or best+1.
                const candidateVersion = trajectories[0].skillVersion + 1;
                logger.log(`[SkillOpt] Candidate: react@${candidateVersion}`);
                logger.log('[SkillOpt] Starting validation rollout');

                await rollout.executeTask('react', candidateVersion, candidateContent, valTask);
                
                const valTrajectory = recorder.getTrajectory(valTask.id);
                if (!valTrajectory) {
                    throw new Error("Validation trajectory not found!");
                }

                const evalResult = await EvaluatorFactory.getEvaluator().evaluate(valTrajectory, { customWorkspace: valSandbox });
                logger.log(`[SkillOpt] Validation score: ${evalResult.score}`);

                return evalResult.score;
            });

            logger.log(`[SkillOpt] ValidationGate: ${result.decision.toUpperCase()}`);
            
            vscode.window.showInformationMessage(`React Pilot Completed. Decision: ${result.decision.toUpperCase()}`);
        } catch (e: any) {
            logger.error('React Pilot failed: ', e);
            vscode.window.showErrorMessage('React Pilot failed. See logs.');
        }
    });
}
