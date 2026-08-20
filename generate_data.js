const fs = require('fs');

// --- 1. Generate ACTIONS (520+) ---
let actions = [];
let actionId = 1;

const a_targets = ["React Component", "Vue App", "Express Route", "Django View", "Spring Controller", "Redux Store", "SQL Query", "CSS Module", "Docker File", "K8s Manifest"];
const a_goals = ["make it modular", "improve readability", "extract functions", "apply SOLID", "reduce complexity", "convert to TS", "remove redundancy", "improve errors", "add logging", "optimize imports"];

for (let t of a_targets) {
  for (let g of a_goals) {
    if (actionId > 150) break;
    actions.push({ id: `action-${actionId++}`, title: `Refactor ${t}: ${g}`, prompt: `Analyze this ${t} and refactor it to ${g}.`, category: "Code Refactoring", isQuickAction: false });
  }
}

const a_errs = ["Null Ref", "Memory Leak", "Race Condition", "Type Error", "Infinite Loop", "CORS Error", "DB Deadlock", "Auth Failure", "Timeout", "OOM"];
const a_ctxs = ["in worker", "in UI", "during API call", "in state init", "during upload", "in DB tx", "in middleware", "in webhook", "in cron job", "in router"];

for (let e of a_errs) {
  for (let c of a_ctxs) {
    if (actionId > 250) break;
    actions.push({ id: `action-${actionId++}`, title: `Debug ${e} ${c}`, prompt: `Investigate ${e} ${c}. Provide step-by-step trace and fix.`, category: "Debugging & Errors", isQuickAction: false });
  }
}

const a_pts = ["API time", "Bundle size", "DB query", "Memory footprint", "CPU util", "Network payload", "DOM render", "Image load", "Startup time", "TTFB"];
const a_pms = ["caching", "lazy loading", "indexing", "memoization", "debouncing", "pooling", "compression", "CDN", "WebWorkers", "Prefetching"];

for (let p of a_pts) {
  for (let m of a_pms) {
    if (actionId > 350) break;
    actions.push({ id: `action-${actionId++}`, title: `Optimize ${p} via ${m}`, prompt: `Optimize ${p} bottleneck using ${m}.`, category: "Performance", isQuickAction: false });
  }
}

const a_rfs = ["security", "a11y", "SEO", "i18n", "mobile UX", "cross-browser", "type safety", "clean code", "testing", "docstrings"];
const a_rss = ["standard", "strict", "OWASP", "WCAG", "High Availability", "Enterprise", "Startup", "Open Source", "PCI-DSS", "HIPAA"];

for (let r of a_rfs) {
  for (let s of a_rss) {
    if (actionId > 450) break;
    actions.push({ id: `action-${actionId++}`, title: `${s} Review for ${r}`, prompt: `Perform ${s} code review focusing on ${r}.`, category: "Code Review", isQuickAction: false });
  }
}

const a_tools = ["Webpack", "Vite", "Babel", "ESLint", "Prettier", "Husky", "Jest", "Cypress", "Docker", "Nginx", "K8s", "Terraform", "GitHub Actions"];
const a_envs = ["React", "Node", "Python", "Go", "Next.js", "Vue", "Angular", "Rust", "Java", "PHP"];

for (let t of a_tools) {
  for (let e of a_envs) {
    if (actionId > 530) break;
    actions.push({ id: `action-${actionId++}`, title: `Setup ${t} for ${e}`, prompt: `Generate config for ${t} tailored for ${e}.`, category: "Setup", isQuickAction: false });
  }
}


// --- 2. Generate RULES (520+) ---
let rules = [];
let ruleId = 1;

const r_aps = ["Clean Arch", "Hexagonal", "Microservices", "Event-Driven", "MVC", "MVVM", "Serverless", "CQRS", "DDD", "Modular Monolith", "SOA"];
const r_ps = ["SOLID", "DRY", "KISS", "YAGNI", "SoC", "Dependency Inversion", "Liskov", "Interface Segregation", "Law of Demeter", "Fail Fast"];

for (let ap of r_aps) {
  for (let p of r_ps) {
    if (ruleId > 150) break;
    rules.push({ id: `rule-${ruleId++}`, title: `Enforce ${ap} with ${p}`, description: `Adhere to ${ap} patterns and prioritize ${p}.`, category: "Architecture", rulePrompt: `Follow ${ap} and prioritize ${p}. Ensure clear boundaries.` });
  }
}

const r_ctx = ["User Input", "Auth", "DB Queries", "API Res", "Sessions", "Uploads", "Passwords", "Integrations", "Headers", "Logging"];
const r_thr = ["XSS", "SQLi", "CSRF", "IDOR", "Data Leaks", "Timing", "Brute Force", "MITM", "Command Inj", "SSRF"];

for (let c of r_ctx) {
  for (let t of r_thr) {
    if (ruleId > 260) break;
    rules.push({ id: `rule-${ruleId++}`, title: `Secure ${c} vs ${t}`, description: `In ${c}, implement validation to prevent ${t}.`, category: "Security", rulePrompt: `Act securely when handling ${c} to prevent ${t} attacks.` });
  }
}

const r_lang = ["TS", "Python", "Go", "Rust", "Java", "C#", "PHP", "Ruby", "Swift", "Kotlin", "C++", "Scala", "Dart"];
const r_feat = ["Strict Types", "Memory Safety", "Concurrency", "Error Handling", "Async/Await", "Functional", "OOP", "Null Safety", "Pattern Matching", "Generics"];

for (let l of r_lang) {
  for (let f of r_feat) {
    if (ruleId > 380) break;
    rules.push({ id: `rule-${ruleId++}`, title: `${l}: ${f}`, description: `When writing ${l}, utilize native ${f}.`, category: "Languages", rulePrompt: `Ensure idiomatic ${l} code emphasizing ${f}.` });
  }
}

const r_areas = ["DB Index", "FE Render", "API Latency", "RAM Usage", "CPU Tasks", "Assets", "Cache", "Network", "State", "GC"];
const r_goals = ["O(1) time", "no leaks", "min bundle", "sub-100ms", "scale out", "pooling", "lazy eval", "debounce", "cache hits", "min repaints"];

for (let a of r_areas) {
  for (let g of r_goals) {
    if (ruleId > 530) break;
    rules.push({ id: `rule-${ruleId++}`, title: `Optimize ${a} for ${g}`, description: `Design ${a} to achieve ${g}.`, category: "Performance", rulePrompt: `Optimize ${a} diligently so that it achieves ${g}.` });
  }
}


// --- 3. Generate MENTIONS (520+) ---
let mentions = [];
let mentionId = 1;

// Adding standard file picker
mentions.push({
  id: "mention-file-picker",
  title: "Attach a File...",
  prompt: "FILE_PICKER",
  category: "Files & Workspaces"
});

const m_apis = ["Stripe", "Twilio", "SendGrid", "AWS S3", "Firebase", "Supabase", "Auth0", "Okta", "Vercel", "Netlify", "Heroku", "GCP", "Azure", "GitHub", "GitLab"];
const m_acts = ["Billing", "SMS", "Emails", "Storage", "Database", "Auth", "SSO", "Deploy", "Analytics", "Logging", "Monitoring", "CI/CD", "Webhooks", "Queues", "Search"];

for (let api of m_apis) {
  for (let act of m_acts) {
    if (mentionId > 200) break;
    mentions.push({ id: `mention-${mentionId++}`, title: `@${api.toLowerCase().replace(' ', '')}-docs: ${act}`, prompt: `@${api.toLowerCase().replace(' ', '')} focus on ${act}`, category: "Cloud & APIs" });
  }
}

const m_fws = ["React", "Vue", "Angular", "NextJS", "NestJS", "Express", "Django", "Flask", "Spring", "Laravel", "Rails", "Svelte", "Solid", "Qwik", "Astro"];
const m_libs = ["Redux", "Zustand", "Tailwind", "MUI", "Bootstrap", "Prisma", "TypeORM", "Mongoose", "Sequelize", "Jest", "Cypress", "Playwright", "Vitest", "Webpack", "Vite"];

for (let fw of m_fws) {
  for (let lib of m_libs) {
    if (mentionId > 420) break;
    mentions.push({ id: `mention-${mentionId++}`, title: `@${fw.toLowerCase()}-${lib.toLowerCase()}-context`, prompt: `@${fw.toLowerCase()} combined with @${lib.toLowerCase()}`, category: "Frameworks & Libs" });
  }
}

const m_ag = ["frontend-agent", "backend-agent", "db-agent", "devops-agent", "security-agent", "qa-agent", "design-agent", "copy-agent", "seo-agent", "pm-agent"];
const m_ts = ["analyze", "refactor", "test", "deploy", "secure", "optimize", "document", "debug", "review", "plan"];

for (let ag of m_ag) {
  for (let t of m_ts) {
    if (mentionId > 530) break;
    mentions.push({ id: `mention-${mentionId++}`, title: `@${ag}: ${t}`, prompt: `@${ag} please ${t} the current workspace`, category: "Agents & Skills" });
  }
}


fs.writeFileSync('/Users/shadahmor/Documents/Projects/VS_Extension/AI Enhancer/webview-ui/src/components/Chat/actionsData.ts', `export const ACTIONS = ${JSON.stringify(actions, null, 2)};\n`);
fs.writeFileSync('/Users/shadahmor/Documents/Projects/VS_Extension/AI Enhancer/webview-ui/src/components/Chat/rulesData.ts', `export const RULES = ${JSON.stringify(rules, null, 2)};\n`);
fs.writeFileSync('/Users/shadahmor/Documents/Projects/VS_Extension/AI Enhancer/webview-ui/src/components/Chat/mentionsData.ts', `export const MENTIONS = ${JSON.stringify(mentions, null, 2)};\n`);

console.log("Data generation complete.");
