import sys

# Update UnifiedContextBuilder.ts
with open("src/services/unifiedContextBuilder.ts", "r") as f:
    code = f.read()

# Add skillVersion to ContextBuilderParams
if "skillVersion?: number;" not in code:
    code = code.replace("existingMessages?: any[];", "existingMessages?: any[];\n    skillVersion?: number;\n    skillName?: string;")

# Use skillVersion in SkillOps
if "params.skillVersion" not in code:
    code = code.replace("const best = registry.getBestSkill(category);", """const best = (params.skillVersion !== undefined && params.skillName === category) 
                        ? registry.loadSkill(category, params.skillVersion) 
                        : registry.getBestSkill(category);""")

with open("src/services/unifiedContextBuilder.ts", "w") as f:
    f.write(code)

# Update llmEngine.ts
with open("src/services/llmEngine.ts", "r") as f:
    code = f.read()

if "customWorkspace?: string;" not in code.split("export interface StreamChatParams")[0]:
    # StreamChatParams is actually not defined at the top, it's defined in the method signature or separately.
    pass

# Replace workspaceRoot in buildContext
code = code.replace("workspaceRoot: vscode.workspace.workspaceFolders?.[0].uri.fsPath || '',", "workspaceRoot: customWorkspace || vscode.workspace.workspaceFolders?.[0].uri.fsPath || '',")

# Add skillName and skillVersion to buildContext
if "skillVersion: skillVersion" not in code:
    code = code.replace("existingMessages: existingMessages || []", "existingMessages: existingMessages || [],\n      skillName: skillName,\n      skillVersion: skillVersion")

# Pass customWorkspace to executeTool
code = code.replace("const result = await orchestrator.executeTool(toolCall.function.name, args);", "const result = await orchestrator.executeTool(toolCall.function.name, args, customWorkspace);")

# Pass customWorkspace to EvaluatorFactory
code = code.replace("evaluator.evaluate(trajectory)", "evaluator.evaluate(trajectory, { customWorkspace })")

with open("src/services/llmEngine.ts", "w") as f:
    f.write(code)

print("Done")
