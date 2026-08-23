with open("src/services/llmGateway.ts", "r") as f:
    code = f.read()

code = code.replace("    skillVersion?: number;\n  }): Promise<void> {\n    const { prompt, contextItems, optimizerConfig, callbacks, cancellationToken, existingMessages, targetModelId, taskId, skillName, skillVersion } = params;", "    skillVersion?: number;\n    customWorkspace?: string;\n  }): Promise<void> {\n    const { prompt, contextItems, optimizerConfig, callbacks, cancellationToken, existingMessages, targetModelId, taskId, skillName, skillVersion, customWorkspace } = params;")

code = code.replace("          ...(skillVersion !== undefined ? { skillVersion } : {})\n        });", "          ...(skillVersion !== undefined ? { skillVersion } : {}),\n          ...(customWorkspace ? { customWorkspace } : {})\n        });")

with open("src/services/llmGateway.ts", "w") as f:
    f.write(code)
