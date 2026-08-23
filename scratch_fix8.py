import re
import os

with open("src/services/llmEngine.ts", "r") as f:
    code = f.read()

# Fix streamOpenAICompatible call
code = code.replace("await this.streamOpenAICompatible(activeModel, prompt, optimizedContextItems, optimizerConfig, wrappedCallbacks, abortController.signal, finalMessages, [], skillName, skillVersion, customWorkspace);", "await this.streamOpenAICompatible(activeModel, prompt, optimizedContextItems, optimizerConfig, wrappedCallbacks, abortController.signal, finalMessages, taskId, recorder, [], skillName, skillVersion, customWorkspace);")

with open("src/services/llmEngine.ts", "w") as f:
    f.write(code)

with open("src/services/skillOpt/evaluator.test.ts", "r") as f:
    code = f.read()
code = code.replace("evaluator.evaluate(trajectory).score", "(await evaluator.evaluate(trajectory)).score")
code = code.replace("evaluator.evaluate(t).score", "(await evaluator.evaluate(t)).score")
with open("src/services/skillOpt/evaluator.test.ts", "w") as f:
    f.write(code)
