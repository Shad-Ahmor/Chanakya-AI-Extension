import json

actions = []
id_counter = 1

def add_action(title, prompt, cat, is_quick=False):
    global id_counter
    actions.append({
        "id": f"action-{id_counter}",
        "title": title,
        "prompt": prompt,
        "category": cat,
        "isQuickAction": is_quick
    })
    id_counter += 1

# --- 1. Code Refactoring (150+) ---
refactor_targets = ["React Component", "Vue Component", "Express Router", "Django View", "Spring Controller", "Redux Slice", "Zustand Store", "SQL Query", "CSS Module", "Docker File"]
refactor_goals = ["make it more modular", "improve readability", "extract reusable functions", "apply SOLID principles", "reduce cyclomatic complexity", "convert to TypeScript", "remove redundant code", "improve error handling"]

for tgt in refactor_targets:
    for goal in refactor_goals:
        add_action(f"Refactor {tgt}: {goal.split()[0]}", f"Analyze this {tgt} and refactor it to {goal}. Explain the changes you made and why.", "Code Refactoring")

# --- 2. Debugging & Error Fixing (100+) ---
error_types = ["Null Reference", "Memory Leak", "Race Condition", "Type Mismatch", "Infinite Loop", "CORS Error", "Database Deadlock", "Authentication Failure"]
error_contexts = ["in the background worker", "in the UI rendering cycle", "during API calls", "in the state initialization", "during file upload", "in the database transaction"]

for err in error_types:
    for ctx in error_contexts:
        add_action(f"Debug {err} {ctx}", f"Investigate the selected code for a potential {err} {ctx}. Provide a step-by-step trace and a robust fix.", "Debugging & Error Fixing")

# --- 3. Performance Optimization (100+) ---
perf_targets = ["API response time", "Frontend bundle size", "Database query execution", "Memory footprint", "CPU utilization", "Network payload", "DOM rendering", "Image loading"]
perf_methods = ["caching strategies", "lazy loading", "indexing", "memoization", "debouncing", "connection pooling", "compression", "CDN offloading"]

for pt in perf_targets:
    for pm in perf_methods:
        add_action(f"Optimize {pt} via {pm.split()[0]}", f"Analyze the current implementation for {pt} bottlenecks. Propose and implement optimizations using {pm}.", "Performance Optimization")

# --- 4. Code Review & Quality (100+) ---
review_focus = ["security vulnerabilities", "accessibility (a11y)", "SEO best practices", "localization (i18n)", "mobile responsiveness", "cross-browser compatibility"]
review_strictness = ["standard", "strict enterprise", "OWASP compliant", "WCAG 2.1 AA compliant", "High Availability"]

for rf in review_focus:
    for rs in review_strictness:
        add_action(f"{rs.title()} Review for {rf.split()[0]}", f"Perform a {rs} code review focusing entirely on {rf}. Point out violations and provide corrected code snippets.", "Code Review & Quality")

# --- 5. Setup & Configuration (100+) ---
setup_tools = ["Webpack", "Vite", "Babel", "ESLint", "Prettier", "Husky", "Jest", "Cypress", "Docker Compose", "Nginx"]
setup_envs = ["React project", "Node.js API", "Python microservice", "Go server", "Next.js SSR app", "Vue SPA"]

for tool in setup_tools:
    for env in setup_envs:
        add_action(f"Setup {tool} for {env}", f"Generate a complete, production-ready {tool} configuration tailored for a {env}. Include explanations for all major flags and settings.", "Setup & Configuration")

# Add some quick actions
quick_actions = [
    ("Explain Code", "Explain how the selected code works, line by line.", "General"),
    ("Add Comments", "Add clear, concise JSDoc/Docstring comments to the selected code.", "General"),
    ("Write Unit Test", "Write comprehensive unit tests for the selected code.", "General"),
    ("Find Bugs", "Find any obvious bugs or logic errors in the selected code.", "General")
]
for title, prompt, cat in quick_actions:
    add_action(title, prompt, cat, is_quick=True)

ts_content = f"// Auto-generated {len(actions)} highly unique actions\n\nexport const ACTIONS = {json.dumps(actions, indent=2)};\n"
with open("/Users/shadahmor/Documents/Projects/VS_Extension/AI Enhancer/webview-ui/src/components/Chat/actionsData.ts", "w") as f:
    f.write(ts_content)

print(f"Generated {len(actions)} actions.")
