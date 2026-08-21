import { useState, useEffect, useCallback } from 'react';
import { vscode } from '../../vscode';
import {
  Zap,
  Code2,
  Layers,
  MessageSquareX,
  Save,
  Info,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  PlusCircle,
  X,
  CheckCircle2,
  AlertTriangle,
  ListX,
  Sparkles,
  Image as ImageIcon,
  Download,
  Maximize2,
  FileText,
  Cpu
} from 'lucide-react';

const LANGUAGE_FRAMEWORKS: Record<string, string[]> = {
  typescript: ['React', 'Next.js', 'Vue', 'Angular', 'Svelte', 'Express', 'NestJS', 'Prisma', 'tRPC', 'Nuxt', 'Remix', 'Astro', 'Hono'],
  javascript: ['React', 'Next.js', 'Vue', 'Angular', 'Svelte', 'Express', 'React Native', 'Meteor', 'Ember', 'AdonisJS', 'Fastify', 'Electron'],
  python: ['Django', 'FastAPI', 'Flask', 'Pyramid', 'Tornado', 'Streamlit', 'Dash', 'Celery', 'SQLAlchemy', 'Pydantic'],
  go: ['Gin', 'Fiber', 'Echo', 'Beego', 'GORM', 'Revel', 'Chi'],
  rust: ['Actix', 'Rocket', 'Tauri', 'Axum', 'Tokio', 'Diesel', 'Yew', 'Dioxus'],
  java: ['Spring Boot', 'Hibernate', 'Micronaut', 'Quarkus', 'Jakarta EE', 'Vert.x', 'Dropwizard', 'Struts'],
  'c++': ['Qt', 'Boost', 'Poco', 'Unreal Engine', 'JUCE', 'wxWidgets'],
  'c#': ['.NET Core', 'ASP.NET', 'Unity', 'Blazor', 'WPF', 'Xamarin', 'MAUI'],
  kotlin: ['Spring Boot', 'Ktor', 'Android Jetpack', 'Compose', 'Exposed'],
  swift: ['SwiftUI', 'UIKit', 'Vapor', 'Perfect', 'Kitura'],
  dart: ['Flutter', 'Riverpod', 'GetX', 'Provider', 'Bloc'],
  ruby: ['Ruby on Rails', 'Sinatra', 'Hanami', 'Sidekiq', 'RSpec'],
  php: ['Laravel', 'Symfony', 'CodeIgniter', 'WordPress', 'Lumen', 'Phalcon', 'CakePHP'],
  c: ['GTK', 'SDL', 'Raylib'],
  sql: ['PostgreSQL', 'MySQL', 'SQLite', 'MongoDB (NoSQL)', 'Redis (NoSQL)'],
};

export interface TokenOptimizerConfig {
  enabled: boolean;
  taskType: 'coding' | 'thinking' | 'reasoning' | 'bug_solving' | 'other';
  platformTarget: string[];
  programmingLanguages: string[];
  frameworks: string[];
  rules: string[];
  negativePrompts: string[];
  contextLines: number;
  skipComments: boolean;
  skipDocstrings: boolean;
  skipImports: boolean;
  responseConciseness: 'normal' | 'concise' | 'ultra_concise';
  removeEmptyLines: boolean;
  removeConsoleLogs: boolean;
  // PxPipe Vision Arbitrage fields
  enablePxPipe: boolean;
  pxpipeTargetModel: 'claude' | 'gemini' | 'openai' | 'auto';
  pxpipeMinChars: number;
  pxpipeCompressSystemPrompt: boolean;
  pxpipeCompressToolSchemas: boolean;
  pxpipeCompressOldHistory: boolean;
}

export const DEFAULT_TOKEN_CONFIG: TokenOptimizerConfig = {
  enabled: true,
  taskType: 'coding',
  platformTarget: [],
  programmingLanguages: [],
  frameworks: [],
  rules: [],
  negativePrompts: [],
  contextLines: 25,
  skipComments: false,
  skipDocstrings: false,
  skipImports: false,
  responseConciseness: 'concise',
  removeEmptyLines: true,
  removeConsoleLogs: false,
  enablePxPipe: true,
  pxpipeTargetModel: 'auto',
  pxpipeMinChars: 2000,
  pxpipeCompressSystemPrompt: true,
  pxpipeCompressToolSchemas: true,
  pxpipeCompressOldHistory: true,
};

function ChipInput({
  label,
  placeholder,
  items,
  onAdd,
  onRemove,
  suggestions = [],
}: {
  label: string;
  placeholder: string;
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  suggestions?: string[];
}) {
  const [value, setValue] = useState('');
  const [showSug, setShowSug] = useState(false);
  const filtered = suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()) && !items.includes(s));
  const commit = (v: string) => {
    const trimmed = v.trim();
    if (trimmed && !items.includes(trimmed)) onAdd(trimmed);
    setValue('');
    setShowSug(false);
  };
  return (
    <div className="mb-4">
      <label className="block text-[var(--vscode-foreground)] font-semibold text-xs mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-1.5 min-h-[28px]">
        {items.map((item) => (
          <span key={item} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
            {item}
            <button type="button" onClick={() => onRemove(item)} className="hover:opacity-70 transition"><X className="w-2.5 h-2.5" /></button>
          </span>
        ))}
        {items.length === 0 && <span className="text-[11px] text-[var(--vscode-descriptionForeground)] italic">None set</span>}
      </div>
      <div className="relative">
        <input
          type="text" value={value} placeholder={placeholder}
          onChange={(e) => { setValue(e.target.value); setShowSug(true); }}
          onFocus={() => setShowSug(true)}
          onBlur={() => setTimeout(() => setShowSug(false), 150)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(value); } }}
          className="w-full bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] rounded px-2.5 py-1.5 text-xs outline-none focus:border-[var(--vscode-focusBorder)] pr-8"
        />
        <button type="button" onClick={() => commit(value)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--vscode-textLink-foreground)] hover:opacity-70 transition">
          <PlusCircle className="w-3.5 h-3.5" />
        </button>
        {showSug && filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[var(--vscode-editorWidget-background)] border border-[var(--vscode-widget-border)] rounded shadow-xl max-h-40 overflow-y-auto">
            {filtered.map((s) => (
              <button key={s} type="button" onMouseDown={() => commit(s)} className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-[var(--vscode-list-hoverBackground)] text-[var(--vscode-foreground)] transition">{s}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RuleListInput({
  label,
  placeholder,
  items,
  onAdd,
  onRemove,
  suggestions = [],
}: {
  label: string;
  placeholder: string;
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  suggestions?: string[];
}) {
  const [value, setValue] = useState('');
  const [showSug, setShowSug] = useState(false);
  const filtered = suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()) && !items.includes(s));
  
  const commit = (v: string) => {
    const trimmed = v.trim();
    if (trimmed && !items.includes(trimmed)) onAdd(trimmed);
    setValue('');
    setShowSug(false);
  };

  return (
    <div className="mb-4">
      <label className="block text-[var(--vscode-foreground)] font-semibold text-xs mb-2">{label}</label>
      
      {/* List of active rules */}
      <div className="flex flex-col gap-2 mb-3">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 p-2 rounded bg-[var(--vscode-textBlockQuote-background)] border border-[var(--vscode-widget-border)]">
            <span className="flex-1 text-[11px] text-[var(--vscode-foreground)] leading-relaxed">{item}</span>
            <button type="button" onClick={() => onRemove(item)} className="text-[var(--vscode-errorForeground)] hover:opacity-70 transition p-1" title="Remove rule">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {items.length === 0 && <div className="text-[11px] text-[var(--vscode-descriptionForeground)] italic py-1">No custom rules added yet.</div>}
      </div>

      {/* Input area */}
      <div className="relative">
        <div className="flex gap-2">
          <input
            type="text" value={value} placeholder={placeholder}
            onChange={(e) => { setValue(e.target.value); setShowSug(true); }}
            onFocus={() => setShowSug(true)}
            onBlur={() => setTimeout(() => setShowSug(false), 200)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(value); } }}
            className="flex-1 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] rounded px-3 py-2 text-xs outline-none focus:border-[var(--vscode-focusBorder)]"
          />
          <button type="button" onClick={() => commit(value)} className="px-3 py-2 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] rounded text-xs font-semibold transition whitespace-nowrap">
            Add Custom
          </button>
        </div>
        
        {showSug && filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[var(--vscode-editorWidget-background)] border border-[var(--vscode-widget-border)] rounded shadow-xl max-h-48 overflow-y-auto">
            <div className="px-2 py-1.5 text-[10px] font-bold text-[var(--vscode-descriptionForeground)] uppercase tracking-wider bg-[var(--vscode-editor-background)] sticky top-0">Suggested Templates</div>
            {filtered.map((s) => (
              <button key={s} type="button" onMouseDown={() => commit(s)} className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--vscode-list-hoverBackground)] text-[var(--vscode-foreground)] transition border-b border-[var(--vscode-widget-border)] last:border-0">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SavingsCard({ cfg }: { cfg: TokenOptimizerConfig }) {
  let savings = 0;
  if (cfg.enabled) savings += 15;
  if (cfg.responseConciseness === 'concise') savings += 20;
  if (cfg.responseConciseness === 'ultra_concise') savings += 40;
  if (cfg.skipComments) savings += 8;
  if (cfg.skipDocstrings) savings += 6;
  if (cfg.skipImports) savings += 4;
  if (cfg.programmingLanguages.length > 0) savings += 5;
  if (cfg.frameworks.length > 0) savings += 5;
  if (cfg.rules.length > 0) savings += Math.min(cfg.rules.length * 3, 12);
  if (cfg.negativePrompts.length > 0) savings += Math.min(cfg.negativePrompts.length * 4, 15);
  savings = Math.min(savings, 75);
  const contextReduction = Math.round(((25 - cfg.contextLines) / 25) * 100);
  return (
    <div className="p-4 rounded-xl border border-[var(--vscode-widget-border)] bg-[var(--vscode-editorWidget-background)] mb-6">
      <div className="flex items-center gap-2 mb-3">
        <TrendingDown className="w-4 h-4 text-emerald-400" />
        <span className="font-bold text-sm text-[var(--vscode-foreground)]">Estimated Token Savings</span>
      </div>
      <div className="flex items-end gap-4">
        <div>
          <div className="text-4xl font-black text-emerald-400">~{savings}%</div>
          <div className="text-[10px] text-[var(--vscode-descriptionForeground)] mt-0.5">per request reduction</div>
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2 text-[11px]">
            <div className="w-24 text-[var(--vscode-descriptionForeground)]">Response Mode</div>
            <div className="flex-1 h-2 rounded-full bg-[var(--vscode-editor-background)] overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${cfg.responseConciseness === 'ultra_concise' ? 100 : cfg.responseConciseness === 'concise' ? 60 : 30}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <div className="w-24 text-[var(--vscode-descriptionForeground)]">Context Lines</div>
            <div className="flex-1 h-2 rounded-full bg-[var(--vscode-editor-background)] overflow-hidden">
              <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${Math.max(contextReduction, 5)}%` }} />
            </div>
            <span className="text-[var(--vscode-descriptionForeground)]">{cfg.contextLines} lines</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <div className="w-24 text-[var(--vscode-descriptionForeground)]">Rules/Negative</div>
            <div className="flex-1 h-2 rounded-full bg-[var(--vscode-editor-background)] overflow-hidden">
              <div className="h-full rounded-full bg-purple-400 transition-all" style={{ width: `${Math.min((cfg.rules.length + cfg.negativePrompts.length) * 10, 100)}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children, defaultOpen = true }: { icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4 border border-[var(--vscode-widget-border)] rounded-xl" style={{ overflow: 'visible' }}>
      <button onClick={() => setOpen(!open)} className={`w-full flex items-center justify-between px-4 py-3 bg-[var(--vscode-editor-background)] hover:bg-[var(--vscode-list-hoverBackground)] transition text-left ${open ? 'rounded-t-xl border-b border-[var(--vscode-widget-border)]' : 'rounded-xl'}`}>
        <div className="flex items-center gap-2 font-semibold text-sm text-[var(--vscode-foreground)]">{icon}{title}</div>
        {open ? <ChevronUp className="w-3.5 h-3.5 opacity-60" /> : <ChevronDown className="w-3.5 h-3.5 opacity-60" />}
      </button>
      {open && <div className="px-4 pt-3 pb-4 bg-[var(--vscode-editorWidget-background)] rounded-b-xl" style={{ overflow: 'visible' }}>{children}</div>}
    </div>
  );
}

export default function TokenOptimizerView({ config }: { config: any }) {
  const [selectedModelId, setSelectedModelId] = useState<string>(config?.activeChatModelId || config?.models?.[0]?.id || config?.models?.[0]?.name || 'default');
  const [allConfigs, setAllConfigs] = useState<Record<string, TokenOptimizerConfig>>({});
  
  const cfg = allConfigs[selectedModelId] || DEFAULT_TOKEN_CONFIG;
  const [saved, setSaved] = useState(false);

  // PxPipe Playground State
  const [pxpipeInputText, setPxpipeInputText] = useState<string>(
    `// [Sample MCP Tool Schema & System Documentation - 12,000 Characters]\nexport interface McpToolCollection {\n  name: string;\n  version: "1.0.0";\n  tools: [\n    { name: "read_file", path: "/src/app.ts", hash: "a3f89b72c910e12" },\n    { name: "execute_command", command: "npm test", timeoutMs: 30000 },\n    { name: "query_database", connection: "postgresql://localhost:5432/chanakya" }\n  ];\n}\n\n// System Guidelines & AST Extraction Rules:\n// 1. Never mutate global state without a transaction.\n// 2. Strict type discrimination must be enforced across IPC.\n// 3. Always preserve line numbering and exact file references.`
  );
  const [pxpipeResult, setPxpipeResult] = useState<{
    dataUri: string;
    width: number;
    height: number;
    charCount: number;
    textTokens: number;
    imageTokens: number;
    savingsPercentage: number;
    factsheet: string[];
  } | null>(null);
  const [isRenderingPxPipe, setIsRenderingPxPipe] = useState<boolean>(false);
  const [showImageModal, setShowImageModal] = useState<boolean>(false);

  useEffect(() => {
    vscode.postMessage({ type: 'getTokenOptimizerConfig' });
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'tokenOptimizerConfig' && msg.payload) {
        // If it's a legacy flat config, convert it to a record with 'default'
        if (msg.payload.enabled !== undefined) {
          setAllConfigs({ default: { ...DEFAULT_TOKEN_CONFIG, ...msg.payload } });
        } else {
          setAllConfigs(msg.payload);
        }
      } else if (msg.type === 'pxpipePreviewResult' && msg.payload) {
        setPxpipeResult(msg.payload);
        setIsRenderingPxPipe(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleRenderPxPipe = () => {
    if (!pxpipeInputText.trim()) return;
    setIsRenderingPxPipe(true);
    vscode.postMessage({
      type: 'renderPxPipePreview',
      payload: {
        text: pxpipeInputText,
        title: `CHANAKYA PXPIPE COMPRESSED CONTEXT (${selectedModelId})`
      }
    });
  };

  const handleDownloadPng = () => {
    if (!pxpipeResult?.dataUri) return;
    const link = document.createElement('a');
    link.href = pxpipeResult.dataUri;
    link.download = `chanakya-pxpipe-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const update = useCallback(<K extends keyof TokenOptimizerConfig>(key: K, value: TokenOptimizerConfig[K]) => {
    setAllConfigs((prev) => ({
      ...prev,
      [selectedModelId]: { ...(prev[selectedModelId] || DEFAULT_TOKEN_CONFIG), [key]: value }
    }));
    setSaved(false);
  }, [selectedModelId]);

  const addToList = (key: 'programmingLanguages' | 'frameworks' | 'rules' | 'negativePrompts' | 'platformTarget', val: string) => {
    setAllConfigs((prev) => {
      const current = prev[selectedModelId] || DEFAULT_TOKEN_CONFIG;
      return { ...prev, [selectedModelId]: { ...current, [key]: [...current[key], val] } };
    });
    setSaved(false);
  };

  const removeFromList = (key: 'programmingLanguages' | 'frameworks' | 'rules' | 'negativePrompts' | 'platformTarget', val: string) => {
    setAllConfigs((prev) => {
      const current = prev[selectedModelId] || DEFAULT_TOKEN_CONFIG;
      return { ...prev, [selectedModelId]: { ...current, [key]: current[key].filter((v) => v !== val) } };
    });
    setSaved(false);
  };

  const STATIC_SMART_RULES: Record<string, { rules: string[]; negatives: string[] }> = {
    python: {
      rules: ['Use list comprehensions and generic types to minimize code size.'],
      negatives: ['Do not write redundant type hints for obvious types.', 'Do not explain standard Python syntax.']
    },
    javascript: {
      rules: ['Use modern ES6+ terse syntax (arrow functions, destructuring).'],
      negatives: ['Do not include common standard imports unless requested.', 'Do not explain basic JavaScript concepts.']
    },
    typescript: {
      rules: ['Use modern ES6+ terse syntax (arrow functions, destructuring).', 'Prefer strict typings and avoid any.'],
      negatives: ['Do not include common standard imports unless requested.', 'Do not explain TypeScript basics.']
    },
    django: {
      rules: ['Use Class Based Views (CBV) or generic views where possible to reduce boilerplate.'],
      negatives: ['Do not explain Django routing or ORM basics.']
    },
    react: {
      rules: ['Use functional components and inline hooks.'],
      negatives: ['Do not write class components or prop-types.']
    },
  };

  const handleAutoGenerate = () => {
    const current = allConfigs[selectedModelId] || DEFAULT_TOKEN_CONFIG;
    const langs = current.programmingLanguages.map(l => l.toLowerCase());
    const frames = current.frameworks.map(f => f.toLowerCase());
    const targets = current.platformTarget.map(t => t.toLowerCase());

    const smartRules = new Set<string>();
    const smartNegatives = new Set<string>();

    // Base coding constraints
    if (current.taskType === 'coding') {
      smartRules.add('Only output the specific modified functions/classes, not the whole file.');
      smartNegatives.add('Do not explain standard API syntax or obvious logic.');
    }

    // Language-specific static rules
    langs.forEach(lang => {
      if (STATIC_SMART_RULES[lang]) {
        STATIC_SMART_RULES[lang].rules.forEach(r => smartRules.add(r));
        STATIC_SMART_RULES[lang].negatives.forEach(n => smartNegatives.add(n));
      }
    });

    // Framework-specific static rules
    frames.forEach(fr => {
      if (STATIC_SMART_RULES[fr]) {
        STATIC_SMART_RULES[fr].rules.forEach(r => smartRules.add(r));
        STATIC_SMART_RULES[fr].negatives.forEach(n => smartNegatives.add(n));
      }
    });

    // Platform target specific additions
    if (targets.includes('website') || targets.includes('web')) {
      smartNegatives.add('Do not include boilerplate HTML/CSS tags if context implies a component snippet.');
    }

    // Bug solving specific rules
    if (current.taskType === 'bug_solving') {
      smartRules.add('Output the direct root cause and exactly 1 concise fix.');
      smartNegatives.add('Do not explain generic debugging strategies.');
    }

    setAllConfigs((prev) => ({
      ...prev,
      [selectedModelId]: {
        ...current,
        rules: Array.from(new Set([...current.rules, ...smartRules])),
        negativePrompts: Array.from(new Set([...current.negativePrompts, ...smartNegatives]))
      }
    }));
    setSaved(false);
  };

  const handleSave = () => {
    vscode.postMessage({ type: 'saveTokenOptimizerConfig', payload: allConfigs as unknown as Record<string, unknown> });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="w-full max-w-5xl mx-auto pt-6 pb-64 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-5 h-5 text-emerald-400" />
              <h2 className="text-xl font-black text-[var(--vscode-foreground)]">Token Optimizer</h2>
            </div>
            <p className="text-xs text-[var(--vscode-descriptionForeground)]">Reduce AI API costs by sending smarter, targeted prompts for maximum efficiency.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => update('enabled', !cfg.enabled)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition ${cfg.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-[var(--vscode-editor-background)] text-[var(--vscode-descriptionForeground)] border border-[var(--vscode-widget-border)]'}`}>
              {cfg.enabled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              {cfg.enabled ? 'Active' : 'Disabled'}
            </button>
            <button onClick={handleSave} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${saved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]'}`}>
              {saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>

        {/* Model Selector Dropdown */}
        <div className="mb-6 p-4 rounded-xl border border-[var(--vscode-widget-border)] bg-[var(--vscode-editorWidget-background)] flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-[var(--vscode-foreground)] mb-1">Configure For Model</div>
            <div className="text-xs text-[var(--vscode-descriptionForeground)]">Set different token optimization rules per model</div>
          </div>
          <div className="relative min-w-[250px]">
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              className="w-full appearance-none bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--vscode-focusBorder)] pr-8 cursor-pointer font-bold"
            >
              <option value="default">Default Configuration</option>
              {config?.models?.map((m: any) => (
                <option key={m.id || m.name} value={m.id || m.name}>
                  {m.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[var(--vscode-descriptionForeground)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <SavingsCard cfg={cfg} />

        {/* PxPipe Vision Arbitrage */}
        <Section icon={<ImageIcon className="w-4 h-4 text-cyan-400" />} title="🖼️ PxPipe Vision Token Arbitrage (Text ➔ Dense Image)">
          <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 mb-4">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 text-xs">
                <div className="font-bold text-cyan-300 flex items-center gap-2">
                  PxPipe Pricing Arbitrage Exploit
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 font-mono">
                    59%–75% Cheaper
                  </span>
                </div>
                <p className="text-slate-300 mt-1 leading-relaxed text-[11px]">
                  LLMs bill text by token count (~1 token per 2.5 chars), but bill images by fixed pixel tile dimensions (~1,600 tokens on Claude, ~258 tokens on Gemini Flash). By packing bulky system prompts, MCP tool schemas, and old conversation history into high-density line-numbered PNG pages, 48,000+ chars are compressed into ~1,600 image tokens with 100/100 OCR reading accuracy.
                </p>
              </div>
            </div>
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[var(--vscode-list-hoverBackground)] cursor-pointer transition border border-white/5">
                <div onClick={() => update('enablePxPipe', !cfg.enablePxPipe)} className={`mt-0.5 rounded-full relative flex-shrink-0 cursor-pointer transition-colors ${cfg.enablePxPipe ? 'bg-cyan-500' : 'bg-[var(--vscode-input-border)]'}`} style={{ height: '18px', minWidth: '32px' }}>
                  <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all ${cfg.enablePxPipe ? 'left-4' : 'left-0.5'}`} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[var(--vscode-foreground)]">Enable PxPipe Vision Compression</div>
                  <div className="text-[10px] text-[var(--vscode-descriptionForeground)]">Automatically convert bulky background contexts to dense images</div>
                </div>
              </label>

              <div>
                <label className="block text-[var(--vscode-foreground)] font-semibold text-xs mb-1">Target Vision Model Profile</label>
                <select
                  value={cfg.pxpipeTargetModel || 'auto'}
                  onChange={(e) => update('pxpipeTargetModel', e.target.value as any)}
                  className="w-full bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] rounded-lg px-3 py-1.5 text-xs outline-none"
                >
                  <option value="auto">Auto-Detect from Active Model</option>
                  <option value="claude">Anthropic Claude (Fable / Sonnet / Opus - ~1600 tokens/tile)</option>
                  <option value="gemini">Google Gemini 2.0 / Flash (~258 tokens/tile)</option>
                  <option value="openai">OpenAI GPT-4o / GPT-5 (~765 tokens/tile)</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-[var(--vscode-foreground)] mb-1">
                  <span>Profitability Gate Threshold:</span>
                  <span className="font-mono text-cyan-400 font-bold">{cfg.pxpipeMinChars || 2000} chars</span>
                </div>
                <input
                  type="range"
                  min={1000}
                  max={8000}
                  step={500}
                  value={cfg.pxpipeMinChars || 2000}
                  onChange={(e) => update('pxpipeMinChars', Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="text-[10px] text-[var(--vscode-descriptionForeground)] mt-0.5">
                  Only compress contexts larger than this threshold where image tokens are cheaper than text tokens.
                </div>
              </div>

              <div className="space-y-1.5">
                {[
                  { key: 'pxpipeCompressToolSchemas', label: 'Compress MCP Tool Definitions & Schemas' },
                  { key: 'pxpipeCompressSystemPrompt', label: 'Compress System Instructions & Rules' },
                  { key: 'pxpipeCompressOldHistory', label: 'Compress Older Chat Turns (Keeps latest 2 in text)' }
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-xs text-[var(--vscode-foreground)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!cfg[key as keyof TokenOptimizerConfig]}
                      onChange={(e) => update(key as any, e.target.checked)}
                      className="accent-cyan-500 rounded"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Live Converter & Playground */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-xs text-white flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                Interactive PxPipe Playground & Live Renderer
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() =>
                    setPxpipeInputText(
                      `// [Sample MCP Tool Collection - 14,000 Chars]\nexport const mcpTools = [\n  { name: "query_database", description: "Executes SQL query on PostgreSQL instance", inputSchema: { properties: { sql: { type: "string" } } } },\n  { name: "read_file", description: "Reads file content safely from workspace", inputSchema: { properties: { path: { type: "string" } } } },\n  { name: "git_diff", description: "Returns uncommitted working tree diff", inputSchema: { properties: {} } }\n];`
                    )
                  }
                  className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 transition"
                >
                  Load MCP Sample
                </button>
                <button
                  onClick={() =>
                    setPxpipeInputText(
                      `// [Sample React 500-Line Component Context]\nimport React, { useState, useEffect } from 'react';\n\nexport function MasterDashboard() {\n  const [data, setData] = useState([]);\n  // ... 500 lines of complex AST & business logic ...\n}`
                    )
                  }
                  className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 transition"
                >
                  Load Code Sample
                </button>
              </div>
            </div>

            <textarea
              value={pxpipeInputText}
              onChange={(e) => setPxpipeInputText(e.target.value)}
              rows={4}
              placeholder="Paste bulky code, JSON tool schemas, system prompt, or conversation history here to test PxPipe token arbitrage..."
              className="w-full p-2.5 bg-black/70 border border-white/10 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400">
                Input Length: <strong className="text-white">{pxpipeInputText.length.toLocaleString()}</strong> characters
              </span>
              <button
                onClick={handleRenderPxPipe}
                disabled={isRenderingPxPipe || !pxpipeInputText.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition shadow-md shadow-cyan-500/20 disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>{isRenderingPxPipe ? 'Rasterizing PNG...' : '⚡ Render PxPipe PNG'}</span>
              </button>
            </div>

            {/* Results Grid */}
            {pxpipeResult && (
              <div className="pt-3 border-t border-white/10 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                    <div className="text-[10px] text-slate-400">As Plain Text</div>
                    <div className="text-xs font-bold text-red-400 mt-0.5">~{pxpipeResult.textTokens.toLocaleString()} tokens</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                    <div className="text-[10px] text-cyan-400">As PxPipe Image</div>
                    <div className="text-xs font-bold text-cyan-300 mt-0.5">~{pxpipeResult.imageTokens.toLocaleString()} tokens</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <div className="text-[10px] text-emerald-400">Token Savings</div>
                    <div className="text-xs font-bold text-emerald-300 mt-0.5">+{pxpipeResult.savingsPercentage}% Cheaper</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                    <div className="text-[10px] text-slate-400">Dimensions</div>
                    <div className="text-xs font-bold text-slate-200 mt-0.5">{pxpipeResult.width}×{pxpipeResult.height}px</div>
                  </div>
                </div>

                {/* Factsheet Extracted Tokens */}
                {pxpipeResult.factsheet.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-black/60 border border-white/5 text-[11px]">
                    <div className="font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      Lossless Exact Factsheet ({pxpipeResult.factsheet.length} critical identifiers preserved in plain text):
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {pxpipeResult.factsheet.map((item, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-slate-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rendered Image Preview Card */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Generated Micro-Monospaced Vision Tile:</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowImageModal(true)}
                        className="flex items-center gap-1 text-xs text-cyan-400 hover:underline"
                      >
                        <Maximize2 className="w-3.5 h-3.5" /> Full Size
                      </button>
                      <button
                        onClick={handleDownloadPng}
                        className="flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                      >
                        <Download className="w-3.5 h-3.5" /> Download PNG
                      </button>
                    </div>
                  </div>

                  <div
                    onClick={() => setShowImageModal(true)}
                    className="relative cursor-pointer rounded-lg overflow-hidden border border-cyan-500/30 max-h-[160px] bg-black group"
                  >
                    <img src={pxpipeResult.dataUri} alt="PxPipe Render" className="w-full object-cover opacity-90 group-hover:opacity-100 transition" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2 text-[10px] text-cyan-300 font-mono">
                      Click to zoom full high-res OCR raster
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Task Type Context */}
        <Section icon={<Layers className="w-4 h-4 text-purple-400" />} title="Task Type & Context">
          <p className="text-[11px] text-[var(--vscode-descriptionForeground)] mb-3">Define the type of task so AI can ignore unrelated contexts.</p>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {([
              { key: 'coding', label: 'Coding' },
              { key: 'bug_solving', label: 'Bug Solving' },
              { key: 'reasoning', label: 'Reasoning' },
              { key: 'thinking', label: 'Thinking' },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => update('taskType', key)} className={`p-2 rounded-lg border text-center transition ${cfg.taskType === key ? 'border-purple-500/60 bg-purple-500/10 text-purple-400 font-bold' : 'border-[var(--vscode-widget-border)] bg-[var(--vscode-editor-background)] hover:border-[var(--vscode-focusBorder)] text-[var(--vscode-foreground)]'}`}>
                <div className="text-xs">{label}</div>
              </button>
            ))}
          </div>

          {cfg.taskType === 'coding' && (
            <ChipInput
              label="Platform Target (Web, Mobile, Script, etc.)"
              placeholder="e.g. Website, iOS, Android, Script..."
              items={cfg.platformTarget}
              onAdd={(v) => addToList('platformTarget', v)}
              onRemove={(v) => removeFromList('platformTarget', v)}
              suggestions={['Website', 'Mobile App', 'Desktop Software', 'CLI Script', 'Server API', 'Database']}
            />
          )}
        </Section>

        {/* Response Conciseness */}
        <Section icon={<MessageSquareX className="w-4 h-4 text-emerald-400" />} title="Response Style">
          <p className="text-[11px] text-[var(--vscode-descriptionForeground)] mb-3">Define how concise the AI's responses should be. Ultra-concise = code only, no explanations.</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'normal', label: 'Normal', desc: 'Detailed explanations', saving: '~0%' },
              { key: 'concise', label: 'Concise', desc: 'Short, to-the-point', saving: '~20%' },
              { key: 'ultra_concise', label: 'Ultra Concise', desc: 'Code only, no fluff', saving: '~40%' },
            ] as const).map(({ key, label, desc, saving }) => (
              <button key={key} onClick={() => update('responseConciseness', key)} className={`p-3 rounded-lg border text-left transition ${cfg.responseConciseness === key ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-[var(--vscode-widget-border)] bg-[var(--vscode-editor-background)] hover:border-[var(--vscode-focusBorder)]'}`}>
                <div className="font-bold text-xs text-[var(--vscode-foreground)] mb-0.5">{label}</div>
                <div className="text-[10px] text-[var(--vscode-descriptionForeground)]">{desc}</div>
                <div className="text-[10px] text-emerald-400 font-bold mt-1">{saving} savings</div>
              </button>
            ))}
          </div>
        </Section>

        {/* Context Lines */}
        <Section icon={<Code2 className="w-4 h-4 text-sky-400" />} title="Code Context Size">
          <p className="text-[11px] text-[var(--vscode-descriptionForeground)] mb-3">Determine the number of surrounding lines to include when sending code context. More lines = more tokens consumed.</p>
          <div className="flex items-center gap-4">
            <input type="range" min={5} max={50} value={cfg.contextLines} onChange={(e) => update('contextLines', Number(e.target.value))} className="flex-1 accent-sky-400" />
            <div className="text-center min-w-[60px]">
              <div className="text-lg font-black text-[var(--vscode-foreground)]">{cfg.contextLines}</div>
              <div className="text-[9px] text-[var(--vscode-descriptionForeground)]">lines</div>
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-[var(--vscode-descriptionForeground)] mt-1 mb-3">
            <span>5 (Min cost)</span>
            <span className="text-emerald-400 font-bold">← Recommended: 15-25</span>
            <span>50 (Max context)</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '🟢 Budget', lines: 10, desc: 'Minimum context, max savings' },
              { label: '⚖️ Balanced', lines: 20, desc: 'Good context, lower cost' },
              { label: '🔵 Full', lines: 35, desc: 'Full context, higher cost' },
            ].map(({ label, lines, desc }) => (
              <button key={lines} onClick={() => update('contextLines', lines)} className="p-2 rounded border border-[var(--vscode-widget-border)] bg-[var(--vscode-editor-background)] hover:border-[var(--vscode-focusBorder)] text-left transition">
                <div className="text-[11px] font-bold text-[var(--vscode-foreground)]">{label}</div>
                <div className="text-[10px] text-[var(--vscode-descriptionForeground)]">{desc}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* Code Stripping */}
        <Section icon={<ListX className="w-4 h-4 text-orange-400" />} title="Code Stripping" defaultOpen={false}>
          <p className="text-[11px] text-[var(--vscode-descriptionForeground)] mb-3">Strip specific elements from the code context to minimize payload size before sending to AI.</p>
          <div className="space-y-2">
            {([
              { key: 'skipComments', label: 'Remove Inline Comments', desc: 'Remove lines starting with // or #' },
              { key: 'skipDocstrings', label: 'Remove Docstrings', desc: 'Remove block comments like /** */ or Python docstrings' },
              { key: 'skipImports', label: 'Remove Import Lines', desc: 'Remove import and require statements' },
              { key: 'removeEmptyLines', label: 'Remove Empty Lines', desc: 'Remove all empty blank lines' },
              { key: 'removeConsoleLogs', label: 'Remove Console.logs', desc: 'Remove console.log or print statements' },
            ] as const).map(({ key, label, desc }) => (
              <label key={key} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[var(--vscode-list-hoverBackground)] cursor-pointer transition">
                <div onClick={() => update(key, !cfg[key])} className={`mt-0.5 rounded-full relative flex-shrink-0 cursor-pointer transition-colors ${cfg[key] ? 'bg-emerald-500' : 'bg-[var(--vscode-input-border)]'}`} style={{ height: '18px', minWidth: '32px' }}>
                  <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all ${cfg[key] ? 'left-4' : 'left-0.5'}`} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[var(--vscode-foreground)]">{label}</div>
                  <div className="text-[10px] text-[var(--vscode-descriptionForeground)]">{desc}</div>
                </div>
              </label>
            ))}
          </div>
        </Section>

        {/* Languages & Frameworks */}
        <Section icon={<Layers className="w-4 h-4 text-purple-400" />} title="Languages & Frameworks">
          <p className="text-[11px] text-[var(--vscode-descriptionForeground)] mb-3">Set your preferred languages and frameworks. The AI will strictly suggest solutions within this ecosystem.</p>
          <ChipInput label="Programming Languages" placeholder="Type & Enter — e.g. TypeScript" items={cfg.programmingLanguages} onAdd={(v) => addToList('programmingLanguages', v)} onRemove={(v) => removeFromList('programmingLanguages', v)} suggestions={['TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'Java', 'C++', 'C#', 'Kotlin', 'Swift', 'Dart', 'Ruby', 'PHP']} />
          
          {(() => {
            const selectedLangs = cfg.programmingLanguages.map(l => l.toLowerCase());
            let dynamicFrameworks: string[] = [];
            if (selectedLangs.length > 0) {
              const frames = new Set<string>();
              selectedLangs.forEach(lang => {
                if (LANGUAGE_FRAMEWORKS[lang]) {
                  LANGUAGE_FRAMEWORKS[lang].forEach(f => frames.add(f));
                }
              });
              dynamicFrameworks = Array.from(frames);
            }
            return (
              <ChipInput 
                label="Frameworks & Libraries" 
                placeholder={selectedLangs.length > 0 ? "Type & Enter — e.g. React" : "Select a programming language first..."}
                items={cfg.frameworks} 
                onAdd={(v) => addToList('frameworks', v)} 
                onRemove={(v) => removeFromList('frameworks', v)} 
                suggestions={dynamicFrameworks} 
              />
            );
          })()}
          
          <button 
            onClick={handleAutoGenerate}
            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs font-bold transition"
          >
            <Sparkles className="w-4 h-4" />
            Auto-Generate Smart Rules & Constraints
          </button>
        </Section>

        {/* Custom Rules */}
        <Section icon={<Info className="w-4 h-4 text-sky-400" />} title="Coding Rules (System Context)">
          <p className="text-[11px] text-[var(--vscode-descriptionForeground)] mb-3">These rules are appended to every prompt automatically, eliminating the need to repeat instructions.</p>
          <RuleListInput label="Rules" placeholder="Type your own custom rule or choose from templates below..." items={cfg.rules} onAdd={(v) => addToList('rules', v)} onRemove={(v) => removeFromList('rules', v)} suggestions={['Always use async/await over .then()', 'Never use var, use const/let', 'Use TypeScript strict mode', 'Prefer functional components', 'Always handle errors with try/catch', 'Never use any type in TypeScript', 'Use named exports over default', 'Keep functions under 50 lines', 'Write self-documenting code']} />
        </Section>

        {/* Negative Prompts */}
        <Section icon={<MessageSquareX className="w-4 h-4 text-red-400" />} title="Negative Prompts (What NOT to do)">
          <p className="text-[11px] text-[var(--vscode-descriptionForeground)] mb-3">Explicitly instruct the AI on what <strong>NOT to do</strong>. This enforces strict negative constraints on its behavior.</p>
          <RuleListInput label="Negative Instructions" placeholder="Type what the AI should NOT do..." items={cfg.negativePrompts} onAdd={(v) => addToList('negativePrompts', v)} onRemove={(v) => removeFromList('negativePrompts', v)} suggestions={['Do not explain the code, just write it', 'Do not add unnecessary comments', 'Do not use deprecated APIs', 'Do not add console.log statements', 'Do not write unit tests unless asked', 'Do not suggest refactoring unless asked', 'Do not add boilerplate imports', 'Do not explain basic concepts']} />
        </Section>

        <div className="flex justify-end pt-2">
          <button onClick={handleSave} className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-sm transition ${saved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]'}`}>
            {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved Successfully!' : 'Save Token Optimizer Config'}
          </button>
        </div>
      </div>

      {/* PxPipe Full Image Modal */}
      {showImageModal && pxpipeResult && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 z-50 animate-in fade-in duration-150">
          <div className="w-full max-w-5xl bg-[#121222] border border-cyan-500/40 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                <span>PxPipe Rasterized Micro-Monospaced Vision Page ({pxpipeResult.width}×{pxpipeResult.height}px)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                  {pxpipeResult.savingsPercentage}% Token Savings
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPng}
                  className="flex items-center gap-1 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-lg transition"
                >
                  <Download className="w-3.5 h-3.5" /> Download PNG
                </button>
                <button
                  onClick={() => setShowImageModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-black rounded-xl p-2 border border-white/5 max-h-[70vh]">
              <img src={pxpipeResult.dataUri} alt="PxPipe High Res" className="w-full object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
