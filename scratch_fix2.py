with open("src/services/llmEngine.ts", "r") as f:
    code = f.read()

# 1. Update streamGemini call
code = code.replace("await this.streamGemini(activeModel, prompt, optimizedContextItems, optimizerConfig, wrappedCallbacks, abortController.signal, finalMessages);", "await this.streamGemini(activeModel, prompt, optimizedContextItems, optimizerConfig, wrappedCallbacks, abortController.signal, finalMessages, taskId, recorder, [], skillName, skillVersion, customWorkspace);")
code = code.replace("await this.streamGemini(activeModel, prompt, optimizedContextItems, optimizerConfig, wrappedCallbacks, abortController.signal, finalMessages, taskId, recorder);", "await this.streamGemini(activeModel, prompt, optimizedContextItems, optimizerConfig, wrappedCallbacks, abortController.signal, finalMessages, taskId, recorder, [], skillName, skillVersion, customWorkspace);")


# 2. Update streamOpenAICompatible call
code = code.replace("await this.streamOpenAICompatible(activeModel, prompt, optimizedContextItems, optimizerConfig, wrappedCallbacks, abortController.signal, finalMessages, taskId, recorder);", "await this.streamOpenAICompatible(activeModel, prompt, optimizedContextItems, optimizerConfig, wrappedCallbacks, abortController.signal, finalMessages, taskId, recorder, [], skillName, skillVersion, customWorkspace);")

# 3. Update streamOpenAICompatible signature
sig1 = """    taskId?: string,
    recorder?: TrajectoryRecorder,
    accumulatedNewMessages: any[] = []"""
sig1_new = """    taskId?: string,
    recorder?: TrajectoryRecorder,
    accumulatedNewMessages: any[] = [],
    skillName?: string,
    skillVersion?: number,
    customWorkspace?: string"""
code = code.replace(sig1, sig1_new)

# 4. Update streamGemini signature
# We need to find how streamGemini is defined. It's likely similar.
# Let's just use regex to add the parameters.
import re
code = re.sub(r'(private async streamGemini\([^)]*accumulatedNewMessages:\s*any\[\]\s*=\s*\[\])', r'\1,\n    skillName?: string,\n    skillVersion?: number,\n    customWorkspace?: string', code)

with open("src/services/llmEngine.ts", "w") as f:
    f.write(code)
print("done")
