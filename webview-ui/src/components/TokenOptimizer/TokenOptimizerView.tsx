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
} from 'lucide-react';

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
    <div className="mb-4 border border-[var(--vscode-widget-border)] rounded-xl">
      <button onClick={() => setOpen(!open)} className={`w-full flex items-center justify-between px-4 py-3 bg-[var(--vscode-editor-background)] hover:bg-[var(--vscode-list-hoverBackground)] transition text-left ${open ? 'rounded-t-xl border-b border-[var(--vscode-widget-border)]' : 'rounded-xl'}`}>
        <div className="flex items-center gap-2 font-semibold text-sm text-[var(--vscode-foreground)]">{icon}{title}</div>
        {open ? <ChevronUp className="w-3.5 h-3.5 opacity-60" /> : <ChevronDown className="w-3.5 h-3.5 opacity-60" />}
      </button>
      {open && <div className="px-4 pt-3 pb-4 bg-[var(--vscode-editorWidget-background)] rounded-b-xl">{children}</div>}
    </div>
  );
}

export default function TokenOptimizerView({ config }: { config: any }) {
  const [selectedModelId, setSelectedModelId] = useState<string>(config?.activeChatModelId || config?.models?.[0]?.id || config?.models?.[0]?.name || 'default');
  const [allConfigs, setAllConfigs] = useState<Record<string, TokenOptimizerConfig>>({});
  
  const cfg = allConfigs[selectedModelId] || DEFAULT_TOKEN_CONFIG;
  const [saved, setSaved] = useState(false);

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
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

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

  const handleAutoGenerate = () => {
    const current = allConfigs[selectedModelId] || DEFAULT_TOKEN_CONFIG;
    const langs = current.programmingLanguages.map(l => l.toLowerCase());
    const frames = current.frameworks.map(f => f.toLowerCase());
    const targets = current.platformTarget.map(t => t.toLowerCase());

    const smartRules = new Set<string>();
    const smartNegatives = new Set<string>();

    if (current.taskType === 'coding') {
      smartRules.add('Only output the specific modified functions/classes, not the whole file.');
      smartNegatives.add('Do not explain standard API syntax or obvious logic.');
      
      if (langs.includes('python')) {
        smartRules.add('Use list comprehensions and generic types to minimize code size.');
        smartNegatives.add('Do not write redundant type hints for obvious types.');
      }
      if (langs.includes('javascript') || langs.includes('typescript')) {
        smartRules.add('Use modern ES6+ terse syntax (arrow functions, destructuring).');
        smartNegatives.add('Do not include common standard imports (like React) unless requested.');
      }
      if (frames.includes('django')) {
        smartRules.add('Use Class Based Views (CBV) or generic views where possible to reduce boilerplate.');
        smartNegatives.add('Do not explain Django routing or ORM basics.');
      }
      if (frames.includes('react')) {
        smartRules.add('Use functional components and inline hooks.');
        smartNegatives.add('Do not write class components or prop-types.');
      }
      if (targets.includes('website') || targets.includes('web')) {
        smartNegatives.add('Do not include boilerplate HTML/CSS tags if context implies a component snippet.');
      }
    } else if (current.taskType === 'bug_solving') {
      smartRules.add('Output the direct root cause and exactly 1 concise fix.');
      smartNegatives.add('Do not explain generic debugging strategies.');
    }

    setAllConfigs((prev) => ({
      ...prev,
      [selectedModelId]: {
        ...current,
        rules: Array.from(new Set([...current.rules, ...smartRules])),
        negativePrompts: Array.from(new Set([...current.negativePrompts, ...smartNegatives])),
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
      <div className="w-full max-w-5xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-5 h-5 text-emerald-400" />
              <h2 className="text-xl font-black text-[var(--vscode-foreground)]">Token Optimizer</h2>
            </div>
            <p className="text-xs text-[var(--vscode-descriptionForeground)]">Reduce AI API costs by sending smarter, targeted prompts. Kam token, same kaam!</p>
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
          <p className="text-[11px] text-[var(--vscode-descriptionForeground)] mb-3">AI ko batao kitne chhote jawab dene hain. Ultra-concise = sirf code, koi explanation nahi.</p>
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
          <p className="text-[11px] text-[var(--vscode-descriptionForeground)] mb-3">Code select karne ke baad kitni surrounding lines context mein bhejna hai. Zyada lines = zyada tokens.</p>
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
          <p className="text-[11px] text-[var(--vscode-descriptionForeground)] mb-3">Code context se kuch cheezein strip karo taaki AI ko send karne se pehle size kam ho.</p>
          <div className="space-y-2">
            {([
              { key: 'skipComments', label: 'Remove Inline Comments', desc: '// ... aur # ... wali lines hata do' },
              { key: 'skipDocstrings', label: 'Remove Docstrings', desc: '"""...""" aur /** ... */ blocks hata do' },
              { key: 'skipImports', label: 'Remove Import Lines', desc: 'import/require statements remove karo' },
              { key: 'removeEmptyLines', label: 'Remove Empty Lines', desc: 'Sare extra empty blank lines hata do' },
              { key: 'removeConsoleLogs', label: 'Remove Console.logs', desc: 'console.log/print statements hata do' },
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
          <p className="text-[11px] text-[var(--vscode-descriptionForeground)] mb-3">Apni preferred languages aur frameworks set karo — AI sirf isi ecosystem mein sochega, extra suggestions nahi dega.</p>
          <ChipInput label="Programming Languages" placeholder="Type & Enter — e.g. TypeScript" items={cfg.programmingLanguages} onAdd={(v) => addToList('programmingLanguages', v)} onRemove={(v) => removeFromList('programmingLanguages', v)} suggestions={['TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'Java', 'C++', 'C#', 'Kotlin', 'Swift', 'Dart', 'Ruby', 'PHP']} />
          <ChipInput label="Frameworks & Libraries" placeholder="Type & Enter — e.g. React" items={cfg.frameworks} onAdd={(v) => addToList('frameworks', v)} onRemove={(v) => removeFromList('frameworks', v)} suggestions={['React', 'Next.js', 'Vue', 'Angular', 'Svelte', 'Express', 'FastAPI', 'Django', 'Spring', 'Flutter', 'Tailwind CSS', 'Prisma', 'GraphQL', 'tRPC']} />
          
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
          <p className="text-[11px] text-[var(--vscode-descriptionForeground)] mb-3">Har prompt ke sath ye rules attach honge. Bar-bar same instruction dene ki zarurat nahi. e.g. "Always use async/await"</p>
          <ChipInput label="Rules" placeholder="Add a rule & press Enter" items={cfg.rules} onAdd={(v) => addToList('rules', v)} onRemove={(v) => removeFromList('rules', v)} suggestions={['Always use async/await over .then()', 'Never use var, use const/let', 'Use TypeScript strict mode', 'Prefer functional components', 'Always handle errors with try/catch', 'Never use any type in TypeScript', 'Use named exports over default', 'Keep functions under 50 lines', 'Write self-documenting code']} />
        </Section>

        {/* Negative Prompts */}
        <Section icon={<MessageSquareX className="w-4 h-4 text-red-400" />} title="Negative Prompts (What NOT to do)">
          <p className="text-[11px] text-[var(--vscode-descriptionForeground)] mb-3">AI ko specifically batao kya <strong>nahi karna</strong>. Yeh system prompt mein add hota hai — AI un cheezeon se bachta hai.</p>
          <ChipInput label="Negative Instructions" placeholder="Add a negative prompt & press Enter" items={cfg.negativePrompts} onAdd={(v) => addToList('negativePrompts', v)} onRemove={(v) => removeFromList('negativePrompts', v)} suggestions={['Do not explain the code, just write it', 'Do not add unnecessary comments', 'Do not use deprecated APIs', 'Do not add console.log statements', 'Do not write unit tests unless asked', 'Do not suggest refactoring unless asked', 'Do not add boilerplate imports', 'Do not explain basic concepts']} />
        </Section>

        <div className="flex justify-end pt-2">
          <button onClick={handleSave} className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-sm transition ${saved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]'}`}>
            {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved Successfully!' : 'Save Token Optimizer Config'}
          </button>
        </div>
      </div>
    </div>
  );
}
