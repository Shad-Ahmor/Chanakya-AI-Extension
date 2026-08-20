import json

actions = []
id_counter = 1

def add_action(title, prompt, cat):
    global id_counter
    actions.append({
        "id": f"action-{id_counter}",
        "title": title,
        "prompt": prompt,
        "category": cat
    })
    id_counter += 1

# 1. Scans & Diagnostics (100)
for i in range(1, 101):
    add_action(f"Diagnostic Scan {i}", f"Run diagnostic scan {i} across the workspace to identify potential bugs, vulnerabilities, or bad patterns. Explain findings.", "Scans & Diagnostics")

# 2. Scaffolding & Setup (100)
for i in range(1, 101):
    add_action(f"Framework Setup {i}", f"Initialize and setup framework architecture pattern {i}. Create necessary files, boilerplate, and dependency configurations.", "Scaffolding & Setup")

# 3. Refactoring & Optimization (100)
for i in range(1, 101):
    add_action(f"Refactor Pattern {i}", f"Refactor the current file or project using optimization technique {i}. Improve Big O complexity, memory usage, and adhere strictly to DRY principles.", "Refactoring & Optimization")

# 4. Documentation (100)
for i in range(1, 101):
    add_action(f"Generate Docs {i}", f"Generate comprehensive documentation and unit tests for module {i}. Include JSDoc/Docstrings and edge cases.", "Documentation")

# 5. General Agentic Workflows (100)
for i in range(1, 101):
    add_action(f"Agent Workflow {i}", f"Execute automated agent workflow {i} to scan, fix, and verify changes autonomously across the codebase.", "General")

# Generate TypeScript file
ts_content = f"// Auto-generated 500 actions\n\nexport const ACTIONS = {json.dumps(actions, indent=2)};\n"
with open("/Users/shadahmor/Documents/Projects/VS_Extension/AI Enhancer/webview-ui/src/components/Chat/actionsData.ts", "w") as f:
    f.write(ts_content)

print(f"Generated {len(actions)} actions.")
