import json

rules = []
id_counter = 1

def add_rule(title, prompt, cat):
    global id_counter
    rules.append({
        "id": f"rule-{id_counter}",
        "title": title,
        "prompt": prompt,
        "category": cat
    })
    id_counter += 1

# --- 1. Architecture & Design (150) ---
arch_patterns = ["Clean Architecture", "Hexagonal Architecture", "Microservices", "Event-Driven Architecture", "MVC", "MVVM", "Serverless Architecture", "CQRS", "Domain-Driven Design", "Monolithic Modular"]
principles = ["SOLID principles", "DRY (Don't Repeat Yourself)", "KISS (Keep It Simple, Stupid)", "YAGNI (You Aren't Gonna Need It)", "Separation of Concerns", "Dependency Inversion", "Liskov Substitution", "Interface Segregation"]

for ap in arch_patterns:
    for p in principles:
        add_rule(
            f"Enforce {ap} with {p.split('(')[0].strip()}",
            f"When writing or modifying code, strictly adhere to {ap} patterns and prioritize {p}. Ensure boundaries are clear and dependencies point inwards.",
            "Architecture & Design"
        )
        if id_counter > 150: break
    if id_counter > 150: break

# --- 2. Security Practices (150) ---
sec_contexts = ["Handling User Input", "Authentication Flows", "Database Queries", "API Responses", "Session Management", "File Uploads", "Password Storage", "Third-party Integrations", "CORS & Headers", "Logging & Monitoring"]
sec_threats = ["XSS", "SQL Injection", "CSRF", "IDOR", "Data Leaks", "Timing Attacks", "Brute Force Attacks", "Man-in-the-Middle", "Command Injection", "SSRF"]

for ctx in sec_contexts:
    for threat in sec_threats:
        add_rule(
            f"Secure {ctx} against {threat}",
            f"In all {ctx}, assume data is malicious. Implement strict validation and sanitization to absolutely prevent {threat}. Follow OWASP Top 10 guidelines.",
            "Security Practices"
        )
        if id_counter > 300: break
    if id_counter > 300: break

# --- 3. Language & Framework Specifics (100) ---
languages = ["TypeScript", "Python", "Go", "Rust", "Java", "C#", "PHP", "Ruby", "Swift", "Kotlin"]
features = ["Strict Typing", "Memory Safety", "Concurrency Models", "Error Handling", "Async/Await patterns", "Functional Paradigms", "Object-Oriented Design", "Package Management", "Null Safety", "Pattern Matching"]

for lang in languages:
    for feat in features:
        add_rule(
            f"{lang}: {feat}",
            f"When writing {lang}, strictly utilize native {feat} features. Avoid legacy workarounds and use the most modern, idiomatic approach available in the latest version.",
            "Language & Framework Specifics"
        )
        if id_counter > 400: break
    if id_counter > 400: break

# --- 4. Performance & Scalability (100) ---
perf_areas = ["Database Indexing", "Frontend Rendering", "API Latency", "Memory Usage", "CPU Bound Tasks", "Asset Loading", "Caching Layers", "Network Calls", "State Updates", "Garbage Collection"]
perf_goals = ["O(1) time complexity where possible", "zero memory leaks", "minimal bundle size", "sub-100ms response time", "horizontal scalability", "efficient connection pooling", "lazy evaluation", "debounced executions", "optimal cache hits", "minimal DOM repaints"]

for area in perf_areas:
    for goal in perf_goals:
        add_rule(
            f"Optimize {area} for {goal}",
            f"When working on {area}, optimization is critical. Design the solution to achieve {goal}. Profile the code theoretically before implementation.",
            "Performance & Scalability"
        )
        if id_counter > 500: break
    if id_counter > 500: break

# --- 5. Fill remaining to 520 ---
test_areas = ["Unit Tests", "Integration Tests", "E2E Tests"]
test_reqs = ["100% Branch Coverage", "Mocking external services", "Deterministic results", "No flaky assertions", "Parallel execution support", "Meaningful descriptions", "Data factories usage"]

for ta in test_areas:
    for tr in test_reqs:
        if id_counter > 520: break
        add_rule(
            f"{ta}: {tr}",
            f"All new {ta} must adhere to the rule: {tr}. Tests should be fast, isolated, and highly reliable.",
            "Testing Standards"
        )

ts_content = f"// Auto-generated {len(rules)} highly unique rules\n\nexport const RULES = {json.dumps(rules, indent=2)};\n"
with open("/Users/shadahmor/Documents/Projects/VS_Extension/AI Enhancer/webview-ui/src/components/Chat/rulesData.ts", "w") as f:
    f.write(ts_content)

print(f"Generated {len(rules)} rules.")
