import json

goals = []
id_counter = 1

def add_goal(title, prompt, cat):
    global id_counter
    goals.append({
        "id": f"goal-{id_counter}",
        "title": title,
        "prompt": f"/goal {prompt}",
        "category": cat
    })
    id_counter += 1

# --- 1. Migrations & Upgrades ---
from_tech = ["React", "Vue 2", "Express", "AngularJS", "Spring 2", "Django 2", "Laravel 5", "Flask", "Node Legacy", "Redux", "Webpack", "REST API", "MongoDB"]
to_tech = ["Next.js", "Nuxt 3", "Apollo GraphQL", "Angular 17", "Spring Boot 3", "FastAPI", "Laravel 10", "Go Microservices", "NestJS", "Zustand", "Vite", "gRPC", "PostgreSQL"]
domains = ["auth service", "dashboard", "payment gateway", "profile system", "entire frontend", "core API", "reporting engine", "notification service", "admin panel"]

for f_tech in from_tech:
    for t_tech in to_tech:
        for domain in domains:
            if id_counter > 150: break
            add_goal(
                f"Migrate {domain.title()}: {f_tech} to {t_tech}",
                f"Analyze {domain} currently built in {f_tech}. Execute a step-by-step migration to {t_tech}. Ensure backward compatibility, update dependencies, and rewrite tests. Do not stop until all tests pass.",
                "Migrations & Upgrades"
            )
        if id_counter > 150: break
    if id_counter > 150: break

# --- 2. Security Audits & Fixes ---
vulns = ["JWT vulnerabilities", "SQL Injection", "XSS", "CSRF", "IDOR", "Rate Limiting flaws", "CORS misconfig", "Secret leaks", "Prototype Pollution", "Path Traversal", "SSRF", "ReDoS"]
components = ["login flow", "checkout", "admin dashboard", "API gateway", "file upload", "messaging system", "registration", "search endpoint", "webhook handler"]

for v in vulns:
    for c in components:
        if id_counter > 250: break
        add_goal(
            f"Fix {v} in {c}",
            f"Act as a DevSecOps engineer. Conduct a deep security audit for {v} in {c}. Identify vulnerable patterns, implement fixes securely, and write regression tests.",
            "Security Audits & Fixes"
        )
    if id_counter > 250: break

# --- 3. Testing & QA Automation ---
test_types = ["Cypress E2E tests", "Playwright E2E", "Jest unit tests", "Vitest unit tests", "Supertest integration", "Selenium UI tests", "PyTest coverage", "JUnit suites", "Mocha/Chai tests", "K6 load tests"]
features = ["onboarding flow", "payment logic", "websocket events", "data export", "state reducers", "3rd-party API integrations", "permission middleware", "order fulfillment", "cron jobs"]

for t in test_types:
    for f in features:
        if id_counter > 350: break
        add_goal(
            f"Write {t} for {f}",
            f"Iterate over {f} and write comprehensive {t}. Identify edge cases, mock dependencies, and ensure coverage reaches 95%. Run tests and fix failing assertions.",
            "Testing & QA Automation"
        )
    if id_counter > 350: break

# --- 4. DevOps & Infrastructure ---
devops_tasks = ["Dockerize", "Create K8s manifests for", "Setup GitHub Actions for", "Write Terraform for", "Setup Prometheus for", "Setup ELK stack for", "Configure AWS ECS for", "Build Helm chart for", "Implement Datadog for"]
targets = ["Node.js microservices", "React frontend", "Python ML API", "Redis cluster", "PostgreSQL database", "worker queues", "GraphQL gateway", "legacy monolith", "CRON schedulers"]

for task in devops_tasks:
    for tgt in targets:
        if id_counter > 430: break
        add_goal(
            f"{task.split()[0]} {tgt}",
            f"Autonomously {task} {tgt}. Ensure production-grade best practices, resource limits, env variable management, and health checks.",
            "DevOps & Infrastructure"
        )
    if id_counter > 430: break

# --- 5. Code Quality & Refactoring ---
refactor_patterns = ["Convert to strict TypeScript", "Apply SOLID principles", "Implement Clean Architecture", "Refactor to microservices", "Use async/await", "Extract reusable hooks", "Use Repository pattern", "Standardize error handling", "Remove dead code"]
modules = ["legacy codebase", "Express routes", "global state", "utils", "database models", "API clients", "complex UI", "data scripts", "validation schemas"]

for rp in refactor_patterns:
    for mod in modules:
        if id_counter > 490: break
        add_goal(
            f"{rp} in {mod}",
            f"Deeply analyze {mod} and execute a refactoring to {rp}. Improve code readability, maintainability, and ensure no business logic is broken.",
            "Code Quality & Refactoring"
        )
    if id_counter > 490: break

# --- 6. Fill remainder up to 520 with Performance Optimization ---
perf_tasks = ["Optimize Webpack size", "Implement Redis cache", "Add DB indexing", "Lazy load assets", "Implement API pagination", "Fix memory leaks", "Optimize Docker image", "Implement CDN caching"]
perf_targets = ["frontend app", "high-traffic API", "Postgres queries", "landing page", "Node.js app", "background jobs", "CI/CD pipeline", "static assets"]

for pt in perf_tasks:
    for ptgt in perf_targets:
        if id_counter > 520: break
        add_goal(
            f"{pt} for {ptgt}",
            f"Profile bottlenecks in {ptgt}. Autonomously {pt}. Measure before/after metrics, ensuring no regressions occur.",
            "Performance Optimization"
        )
    if id_counter > 520: break

# Generate TypeScript file
ts_content = f"// Auto-generated {len(goals)} highly unique and researched agentic goals\n\nexport const GOALS = {json.dumps(goals, indent=2)};\n"
with open("/Users/shadahmor/Documents/Projects/VS_Extension/AI Enhancer/webview-ui/src/components/Chat/goalsData.ts", "w") as f:
    f.write(ts_content)

print(f"Generated {len(goals)} unique goals.")
