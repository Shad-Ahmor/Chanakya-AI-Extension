import json

rules = []
id_counter = 1

def add_rule(title, desc, prompt, cat):
    global id_counter
    rules.append({
        "id": f"rule-{id_counter}",
        "title": title,
        "description": desc,
        "rulePrompt": prompt,
        "category": cat
    })
    id_counter += 1

# 1. Architecture & Design Patterns
for i in range(1, 51):
    add_rule(f"Architecture Principle {i}", f"Follow architectural best practice {i}", f"Apply architectural best practice {i} to ensure scalability and maintainability in the codebase.", "Architecture & Design Patterns")

# 2. React & Frontend
for i in range(1, 51):
    add_rule(f"React Best Practice {i}", f"Follow React best practice {i}", f"Apply React best practice {i} regarding hooks, state management, and component lifecycle.", "React & Frontend")

# 3. Python & Django
for i in range(1, 51):
    add_rule(f"Python Guideline {i}", f"Follow Python/Django guideline {i}", f"Ensure strict PEP8 compliance and apply Django best practice {i}.", "Python & Django")

# 4. Security
for i in range(1, 51):
    add_rule(f"Security Rule {i}", f"Enforce security rule {i}", f"Apply security practice {i} to prevent vulnerabilities like XSS, SQLi, and CSRF.", "Security & Zero Vulnerability")

# 5. Clean Code
for i in range(1, 51):
    add_rule(f"Clean Code Rule {i}", f"Apply clean code rule {i}", f"Refactor code to follow clean code rule {i} for better readability and maintainability.", "Clean Code")

# 6. Database
for i in range(1, 51):
    add_rule(f"Database Optimization {i}", f"Database optimization {i}", f"Optimize database queries and schema using technique {i}.", "Database & SQL")

# 7. Testing
for i in range(1, 51):
    add_rule(f"Testing Standard {i}", f"Testing standard {i}", f"Write tests following standard {i} to ensure high code coverage and reliability.", "Testing & QA")

# 8. Node.js
for i in range(1, 51):
    add_rule(f"Node.js Practice {i}", f"Node.js practice {i}", f"Apply Node.js performance and architecture practice {i}.", "Node.js & Backend")

# 9. DevOps & CI/CD
for i in range(1, 51):
    add_rule(f"DevOps Rule {i}", f"DevOps rule {i}", f"Follow DevOps and CI/CD best practice {i}.", "DevOps & CI/CD")

# 10. UI/UX
for i in range(1, 51):
    add_rule(f"UI/UX Guideline {i}", f"UI/UX guideline {i}", f"Apply UI/UX design principle {i} for better accessibility and aesthetics.", "UI/UX & CSS")

# Generate TypeScript file
ts_content = f"// Auto-generated 500 rules\n\nexport const RULES = {json.dumps(rules, indent=2)};\n"
with open("/Users/shadahmor/Documents/Projects/VS_Extension/AI Enhancer/webview-ui/src/components/Chat/rulesData.ts", "w") as f:
    f.write(ts_content)

print(f"Generated {len(rules)} rules.")
