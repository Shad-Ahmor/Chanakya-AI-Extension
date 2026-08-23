# Fix llmEngine.ts streamGemini call
with open("src/services/llmEngine.ts", "r") as f:
    code = f.read()
code = code.replace("abortController.signal, finalMessages, taskId, recorder, [], skillName, skillVersion, customWorkspace);", "abortController.signal, finalMessages, [], skillName, skillVersion, customWorkspace);")
with open("src/services/llmEngine.ts", "w") as f:
    f.write(code)

# Fix evaluator.test.ts
import re
with open("src/services/skillOpt/evaluator.test.ts", "r") as f:
    code = f.read()
# The tests might be doing `const result = evaluator.evaluate(trajectory)` or similar.
# Let's just make the tests async and use await.
code = code.replace("() => {", "async () => {")
code = code.replace("evaluator.evaluate(trajectory)", "await evaluator.evaluate(trajectory)")
code = code.replace("evaluator.evaluate(t)", "await evaluator.evaluate(t)")

# Wait, `evaluator.evaluate(t)` might already be inside assert, so `await` handles it.
with open("src/services/skillOpt/evaluator.test.ts", "w") as f:
    f.write(code)

# Fix skillOptService.ts
with open("src/services/skillOpt/skillOptService.ts", "r") as f:
    code = f.read()
code = code.replace("const result = evaluator.evaluate(trajectory);", "const result = await evaluator.evaluate(trajectory);")
code = code.replace("const currentResult = evaluator.evaluate(t);", "const currentResult = await evaluator.evaluate(t);")
with open("src/services/skillOpt/skillOptService.ts", "w") as f:
    f.write(code)
