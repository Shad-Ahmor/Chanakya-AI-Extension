import re

with open("src/services/skillOpt/evaluator.ts", "r") as f:
    code = f.read()

# Update Evaluator interface
code = code.replace("evaluate(trajectory: Trajectory): Promise<EvaluationResult>;", "evaluate(trajectory: Trajectory, options?: { customWorkspace?: string }): Promise<EvaluationResult>;")

# Update TechnologyAwareEvaluator
code = code.replace("public async evaluate(trajectory: Trajectory): Promise<EvaluationResult> {", "public async evaluate(trajectory: Trajectory, options?: { customWorkspace?: string }): Promise<EvaluationResult> {")

# Update getWorkspaceRoot
code = code.replace("private async getWorkspaceRoot(): Promise<string> {\n        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';\n    }", "private async getWorkspaceRoot(options?: { customWorkspace?: string }): Promise<string> {\n        return options?.customWorkspace || trajectory.customWorkspace || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';\n    }")
# Wait, trajectory is not in scope for getWorkspaceRoot unless we pass it.
