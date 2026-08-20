import json

goals = []
id_counter = 1

def add_goal(title, prompt, cat):
    global id_counter
    goals.append({
        "id": f"goal-{id_counter}",
        "title": title,
        "prompt": prompt,
        "category": cat
    })
    id_counter += 1

# 1. Project Migrations & Upgrades (100)
for i in range(1, 101):
    add_goal(f"Major Migration Goal {i}", f"/goal Analyze the entire codebase and execute a step-by-step migration to upgrade the architecture following best practice {i}. Do not stop until all tests pass.", "Migrations & Upgrades")

# 2. Comprehensive Security Audits (100)
for i in range(1, 101):
    add_goal(f"Deep Security Audit {i}", f"/goal Act as a senior DevSecOps engineer. Conduct a deep security audit for vulnerability type {i} across the workspace, implement the fixes, and write regression tests.", "Security Audits")

# 3. Test Driven Development (TDD) (100)
for i in range(1, 101):
    add_goal(f"Full Test Coverage {i}", f"/goal Iterate over the untested modules in the workspace and write comprehensive unit, integration, and E2E tests using methodology {i} until coverage reaches 95%.", "Testing & QA")

# 4. Feature Development (100)
for i in range(1, 101):
    add_goal(f"End-to-End Feature {i}", f"/goal Design, implement, and test full-stack feature {i}. Start by updating the database schema, write the backend API, and finally build the frontend UI.", "Feature Development")

# 5. Autonomous DevOps & CI/CD (100)
for i in range(1, 101):
    add_goal(f"DevOps Automation {i}", f"/goal Containerize the application, set up a local Kubernetes cluster configuration, and create CI/CD pipelines following modern pattern {i}.", "DevOps & CI/CD")

# Generate TypeScript file
ts_content = f"// Auto-generated 500 goals\n\nexport const GOALS = {json.dumps(goals, indent=2)};\n"
with open("/Users/shadahmor/Documents/Projects/VS_Extension/AI Enhancer/webview-ui/src/components/Chat/goalsData.ts", "w") as f:
    f.write(ts_content)

print(f"Generated {len(goals)} goals.")
