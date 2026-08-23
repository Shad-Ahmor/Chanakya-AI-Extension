import re

# Fix evaluator test
with open("src/services/skillOpt/evaluator.test.ts", "r") as f:
    code = f.read()
code = code.replace("evaluator.evaluate(trajectory, false)", "evaluator.evaluate(trajectory)")
with open("src/services/skillOpt/evaluator.test.ts", "w") as f:
    f.write(code)

# Fix skillOptService.ts
with open("src/services/skillOpt/skillOptService.ts", "r") as f:
    code = f.read()
code = code.replace("evaluator.evaluate(trajectory, true)", "evaluator.evaluate(trajectory)")
with open("src/services/skillOpt/skillOptService.ts", "w") as f:
    f.write(code)

# Fix llmEngine.ts
with open("src/services/llmEngine.ts", "r") as f:
    code = f.read()
code = code.replace("{ customWorkspace: customWorkspace || undefined }", "...(customWorkspace ? { customWorkspace } : {})")
code = code.replace("skillVersion: skillVersion", "...(skillVersion ? { skillVersion } : {})")
code = code.replace("skillName: skillName,", "...(skillName ? { skillName } : {}),")
# streamGemini signature has 13 arguments instead of 11? Wait, I added it in streamGemini call twice.
# "await this.streamGemini(activeModel, prompt, optimizedContextItems, optimizerConfig, wrappedCallbacks, abortController.signal, finalMessages, taskId, recorder, [], skillName, skillVersion, customWorkspace);"
# but I replaced streamGemini with 13 arguments where the old streamGemini had 7! Oh, wait, in streamGemini I added it to the declaration but the original one was:
# "private async streamGemini(model: ModelConfig, prompt: string, contextItems: ContextItem[], optimizerConfig: any, callbacks: StreamCallbacks, signal: AbortSignal, existingMessages?: any[], taskId?: string, recorder?: TrajectoryRecorder, accumulatedNewMessages: any[] = []" => 10 arguments.
# If I passed 13 arguments, it's 3 extra! Let's check the streamGemini call.
code = code.replace("finalMessages, taskId, recorder, [], skillName, skillVersion, customWorkspace);", "finalMessages, taskId, recorder, [], skillName, skillVersion, customWorkspace);")

with open("src/services/llmEngine.ts", "w") as f:
    f.write(code)

# Fix evaluator.ts unused variables
with open("src/services/skillOpt/evaluator.ts", "r") as f:
    code = f.read()
code = code.replace("const workspaceRoot = await this.getWorkspaceRoot(options);", "const workspaceRoot = await this.getWorkspaceRoot(options);\n        const results = await this.detectStackAndTest(workspaceRoot);")
# Wait, I accidentally deleted `const results = await this.detectStackAndTest(workspaceRoot);` earlier!
# Let me just restore `evaluator.ts` from git and then apply the change correctly!
import subprocess
subprocess.run(["git", "checkout", "src/services/skillOpt/evaluator.ts"])

with open("src/services/skillOpt/evaluator.ts", "r") as f:
    code = f.read()
code = code.replace("evaluate(trajectory: Trajectory, deterministicChecks?: boolean): Promise<EvaluationResult>;", "evaluate(trajectory: Trajectory, options?: { customWorkspace?: string }): Promise<EvaluationResult>;")
code = code.replace("public async evaluate(trajectory: Trajectory, deterministicChecks: boolean = true): Promise<EvaluationResult> {", "public async evaluate(trajectory: Trajectory, options?: { customWorkspace?: string }): Promise<EvaluationResult> {")
code = code.replace("private async getWorkspaceRoot(): Promise<string> {", "private async getWorkspaceRoot(options?: { customWorkspace?: string }): Promise<string> {")
code = code.replace("return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';", "return options?.customWorkspace || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';")

# Replace deterministicChecks logic in DeterministicEvaluator
code = code.replace("if (deterministicChecks) {\n            const workspaceRoot = await this.getWorkspaceRoot();", "if (true) {\n            const workspaceRoot = await this.getWorkspaceRoot(options);")

# Update BaseTrajectoryEvaluator
code = code.replace("public async evaluate(trajectory: Trajectory): Promise<EvaluationResult> {", "public async evaluate(trajectory: Trajectory, options?: { customWorkspace?: string }): Promise<EvaluationResult> {")
with open("src/services/skillOpt/evaluator.ts", "w") as f:
    f.write(code)

