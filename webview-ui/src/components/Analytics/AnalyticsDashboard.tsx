import { useState, useEffect } from 'react';
import { vscode } from '../../vscode';
import { AppConfig, ModelConfig } from '../../types/config';
import {
  BarChart2,
  Zap,
  MessageSquare,
  RefreshCw,
  Trash2,
  Activity,
  ArrowUpRight,
  CheckCircle2,
  LogOut,
  LogIn,
  Clock,
  AlertCircle
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModelStat {
  promptTokens: number;
  completionTokens: number;
  requests: number;
  avgDuration?: number;
  errors?: number;
  avgTTFT?: number;
}

interface TokenStats {
  [modelId: string]: ModelStat;
}

export interface TokenUsageRecord {
  timestamp: number;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  ttftMs: number;
  isError: boolean;
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

const COLORS = [
  '#6366f1', '#22d3ee', '#a78bfa', '#34d399', '#fb923c',
  '#f472b6', '#facc15', '#60a5fa', '#e879f9', '#4ade80',
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Animated Donut Chart ────────────────────────────────────────────────────

function DonutChart({ data, size = 140 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const [animated, setAnimated] = useState(false);
  const radius = size / 2 - 16;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, [data]);

  let offset = 0;
  const segments = data.map((d) => {
    const pct = total > 0 ? d.value / total : 0;
    const dash = animated ? pct * circumference : 0;
    const seg = { ...d, dash, gap: circumference - dash, offset, pct };
    offset += dash;
    return seg;
  });

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={18} stroke="var(--vscode-editor-background)" />
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            strokeWidth={18}
            stroke={seg.color}
            strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
            strokeDashoffset={-seg.offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-xl font-black text-[var(--vscode-foreground)]">{fmt(total)}</div>
        <div className="text-[9px] text-[var(--vscode-descriptionForeground)]">total</div>
      </div>
    </div>
  );
}

// ─── Line Chart (Mock Time Series) ──────────────────────────────────────────────

function LineChart({ data, color, title, unit }: { data: number[]; color: string; title: string; unit: string }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const padding = range * 0.1;
  
  const width = 300;
  const height = 100;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * width;
    const y = height - ((d - min + padding) / (range + padding * 2)) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="p-4 rounded-xl border border-[var(--vscode-widget-border)] bg-[var(--vscode-editorWidget-background)] flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="font-bold text-xs text-[var(--vscode-foreground)]">{title}</div>
        <div className="text-[10px] text-[var(--vscode-descriptionForeground)] bg-[var(--vscode-editor-background)] px-2 py-0.5 rounded border border-[var(--vscode-widget-border)]">
          {unit}
        </div>
      </div>
      <div className="relative w-full h-24 mb-1">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
            style={{ filter: `drop-shadow(0px 4px 6px ${color}40)` }}
          />
        </svg>
      </div>
      <div className="flex justify-between text-[9px] text-[var(--vscode-descriptionForeground)] uppercase tracking-wider mt-2">
        <span>Past</span>
        <span>Current</span>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="p-4 rounded-xl border border-[var(--vscode-widget-border)] bg-[var(--vscode-editorWidget-background)] flex items-start gap-3">
      <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: `${color}20` }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-[var(--vscode-descriptionForeground)] mb-0.5">{label}</div>
        <div className="text-xl font-black text-[var(--vscode-foreground)] leading-tight">{value}</div>
        {sub && <div className="text-[10px] text-[var(--vscode-descriptionForeground)] mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

interface Props {
  config: AppConfig;
  onSetActiveModel: (modelId: string) => void;
}

export default function AnalyticsDashboard({ config, onSetActiveModel }: Props) {
  const [stats, setStats] = useState<TokenStats>({});
  const [history, setHistory] = useState<TokenUsageRecord[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>(config.activeChatModelId || config.models[0]?.id || '');
  const [loading, setLoading] = useState(true);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    vscode.postMessage({ type: 'getTokenStats' });
    const handler = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'tokenStatsResult') {
        // Handle both old format (stats only) and new format {stats, history}
        if (msg.payload && typeof msg.payload.history !== 'undefined') {
          setStats(msg.payload.stats);
          setHistory(msg.payload.history);
        } else {
          setStats(msg.payload as TokenStats);
          setHistory([]);
        }
        setLoading(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleClear = () => {
    vscode.postMessage({ type: 'clearTokenStats' });
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  const handleSelectModel = (model: ModelConfig) => {
    setSelectedModelId(model.id || model.name);
    onSetActiveModel(model.id || model.name);
  };

  // Aggregate stats
  const totalPrompt = Object.values(stats).reduce((s, v) => s + v.promptTokens, 0);
  const totalCompletion = Object.values(stats).reduce((s, v) => s + v.completionTokens, 0);
  const totalTokens = totalPrompt + totalCompletion;

  // Chart data — by model
  const chartData = config.models.map((m, i) => {
    const st = stats[m.id || m.name];
    return {
      label: m.name,
      value: st ? st.promptTokens + st.completionTokens : 0,
      color: COLORS[i % COLORS.length],
    };
  }).filter((d) => d.value > 0);



  const [timeFilter, setTimeFilter] = useState<'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

  // Filter history based on time period
  const now = Date.now();
  const timeThresholds = {
    hourly: now - (24 * 60 * 60 * 1000), // Last 24 hours
    daily: now - (7 * 24 * 60 * 60 * 1000), // Last 7 days
    weekly: now - (4 * 7 * 24 * 60 * 60 * 1000), // Last 4 weeks
    monthly: now - (30 * 24 * 60 * 60 * 1000), // Last 30 days
    yearly: now - (365 * 24 * 60 * 60 * 1000), // Last 365 days
  };
  
  // Calculate dynamic stats for ALL models based on the time filter
  const filteredStats: TokenStats = {};
  history.forEach(r => {
    if (r.timestamp >= timeThresholds[timeFilter]) {
      if (!filteredStats[r.modelId]) {
        filteredStats[r.modelId] = {
          requests: 0,
          promptTokens: 0,
          completionTokens: 0,
          avgDuration: 0,
          avgTTFT: 0,
          errors: 0
        };
      }
      const st = filteredStats[r.modelId];
      st.requests++;
      st.promptTokens += r.promptTokens;
      st.completionTokens += r.completionTokens;
      // Note: For simplicity we will average these later if needed, but the original logic just stored sum and averaged on display.
      // Actually, since TokenStats requires avgDuration, let's store sums here and compute averages after the loop.
      st.avgDuration = (st.avgDuration || 0) + r.durationMs;
      st.avgTTFT = (st.avgTTFT || 0) + r.ttftMs;
      if (r.isError) st.errors = (st.errors || 0) + 1;
    }
  });

  // Calculate averages for filtered stats
  Object.keys(filteredStats).forEach(key => {
    const st = filteredStats[key];
    if (st.requests > 0) {
      st.avgDuration = st.avgDuration! / st.requests;
      st.avgTTFT = st.avgTTFT! / st.requests;
    }
  });

  // Top cards use active model's filtered stats
  const activeStats = filteredStats[selectedModelId] || { requests: 0, promptTokens: 0, completionTokens: 0, avgDuration: 0, avgTTFT: 0, errors: 0 };
  const cardReqs = activeStats.requests;
  const cardPromptTokens = activeStats.promptTokens;
  const cardCompTokens = activeStats.completionTokens;
  const cardTotalTokens = cardPromptTokens + cardCompTokens;
  const cardAvgDur = activeStats.avgDuration || 0;
  const cardAvgTTFT = activeStats.avgTTFT || 0;
  const cardErrors = activeStats.errors || 0;

  // Calculate Line Chart points
  // Group by periods (e.g. 24 buckets for hourly, 7 for daily)
  const buckets = timeFilter === 'hourly' ? 24 : timeFilter === 'daily' ? 7 : timeFilter === 'weekly' ? 4 : timeFilter === 'monthly' ? 30 : 12;
  const bucketSize = (now - timeThresholds[timeFilter]) / buckets;
  
  const latencyBuckets = new Array(buckets).fill(0).map(() => ({ sum: 0, count: 0 }));
  const tokenBuckets = new Array(buckets).fill(0);

  const activeModelHistory = history.filter(h => (h.modelId === selectedModelId) && (h.timestamp >= timeThresholds[timeFilter]));
  
  activeModelHistory.forEach(r => {
    const bucketIdx = Math.max(0, Math.min(buckets - 1, Math.floor((r.timestamp - timeThresholds[timeFilter]) / bucketSize)));
    latencyBuckets[bucketIdx].sum += r.durationMs;
    latencyBuckets[bucketIdx].count += 1;
    tokenBuckets[bucketIdx] += (r.promptTokens + r.completionTokens);
  });

  const latencyChartData = latencyBuckets.map(b => b.count > 0 ? b.sum / b.count : 0);
  const tokenChartData = tokenBuckets;


  return (
    <div className="h-full overflow-y-auto">
      <div className="w-full mx-auto py-6 px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart2 className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl font-black text-[var(--vscode-foreground)]">Analytics Dashboard</h2>
            </div>
            <p className="text-xs text-[var(--vscode-descriptionForeground)] mb-2">Model ki performance, token usage, aur cost — ek jagah pe</p>
            
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--vscode-descriptionForeground)] uppercase tracking-wider font-semibold">Active Model:</span>
              <select 
                value={selectedModelId}
                onChange={(e) => {
                  const m = config.models.find(mod => (mod.id || mod.name) === e.target.value);
                  if (m) handleSelectModel(m);
                }}
                className="bg-[var(--vscode-dropdown-background)] text-[var(--vscode-dropdown-foreground)] border border-[var(--vscode-dropdown-border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--vscode-focusBorder)] transition-colors min-w-[150px]"
              >
                {config.models.map(m => (
                  <option key={m.id || m.name} value={m.id || m.name}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-[var(--vscode-input-background)] border border-[var(--vscode-widget-border)] rounded-lg p-0.5 shadow-sm">
              {(['hourly', 'daily', 'weekly', 'monthly', 'yearly'] as const).map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeFilter(tf)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-all ${
                    timeFilter === tf
                      ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] shadow-sm'
                      : 'text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
            
            <div className="h-6 w-px bg-[var(--vscode-widget-border)] mx-1"></div>

            <button
              onClick={() => { setLoading(true); vscode.postMessage({ type: 'getTokenStats' }); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--vscode-widget-border)] hover:bg-[var(--vscode-list-hoverBackground)] transition text-[var(--vscode-foreground)]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleClear}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${cleared ? 'bg-emerald-500/20 text-emerald-400' : 'border border-red-500/30 text-red-400 hover:bg-red-500/10'}`}
            >
              {cleared ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
              {cleared ? 'Cleared!' : 'Reset Stats'}
            </button>
          </div>
        </div>

        {/* Top Stat Cards (Active Model) */}
        <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4 lg:grid-cols-7">
          <StatCard icon={<MessageSquare className="w-4 h-4" />} label="REQUESTS" value={fmt(cardReqs)} color="#22d3ee" />
          <StatCard icon={<Zap className="w-4 h-4" />} label="TOTAL TOKENS USED" value={fmt(cardTotalTokens)} color="#6366f1" />
          <StatCard icon={<LogOut className="w-4 h-4" />} label="PROMPT TOKENS" value={fmt(cardPromptTokens)} color="#f43f5e" />
          <StatCard icon={<LogIn className="w-4 h-4" />} label="COMPLETION TOKENS" value={fmt(cardCompTokens)} color="#34d399" />
          <StatCard icon={<Clock className="w-4 h-4" />} label="AVG DURATION" value={`${cardAvgDur.toFixed(1)}s`} color="#f59e0b" />
          <StatCard icon={<AlertCircle className="w-4 h-4" />} label="ERRORS" value={fmt(cardErrors)} color="#ef4444" />
          <StatCard icon={<Activity className="w-4 h-4" />} label="AVGTTFT" value={`${cardAvgTTFT.toFixed(2)}s`} color="#8b5cf6" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_180px]">
          {/* Left: Model Cards */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-[var(--vscode-textLink-foreground)]" />
              <span className="font-bold text-sm text-[var(--vscode-foreground)]">Model Usage</span>
              <span className="text-[10px] text-[var(--vscode-descriptionForeground)] ml-auto">Click to set as active</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[var(--vscode-widget-border)] bg-[var(--vscode-editorWidget-background)]">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-[var(--vscode-widget-border)] bg-[var(--vscode-list-hoverBackground)]">
                    <th className="p-3 text-xs font-semibold text-[var(--vscode-foreground)]">Model</th>
                    <th className="p-3 text-xs font-semibold text-[var(--vscode-foreground)]">Requests</th>
                    <th className="p-3 text-xs font-semibold text-[var(--vscode-foreground)]">Total Tokens</th>
                    <th className="p-3 text-xs font-semibold text-[var(--vscode-foreground)]">Avg Duration</th>
                    <th className="p-3 text-xs font-semibold text-[var(--vscode-foreground)]">Avg TTFT</th>
                    <th className="p-3 text-xs font-semibold text-[var(--vscode-foreground)] text-right">ERROR Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--vscode-widget-border)]">
                  {config.models.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[var(--vscode-descriptionForeground)]">
                        <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">No models configured yet.</p>
                      </td>
                    </tr>
                  ) : (
                    [...config.models]
                      .sort((a, b) => {
                        const sa = filteredStats[a.id || a.name];
                        const sb = filteredStats[b.id || b.name];
                        const ta = sa ? sa.promptTokens + sa.completionTokens : 0;
                        const tb = sb ? sb.promptTokens + sb.completionTokens : 0;
                        return tb - ta;
                      })
                      .map((model) => {
                        const st = filteredStats[model.id || model.name];
                        const totalTokens = st ? st.promptTokens + st.completionTokens : 0;
                        const reqs = st?.requests || 0;
                        const errors = st?.errors || 0;
                        const errRate = reqs > 0 ? (errors / reqs) * 100 : 0;
                        const avgDur = st?.avgDuration || 0;
                        const avgTtft = st?.avgTTFT || 0;
                        const isActive = selectedModelId === (model.id || model.name);
                        
                        return (
                          <tr 
                            key={model.id || model.name}
                            onClick={() => handleSelectModel(model)}
                            className={`cursor-pointer transition-colors ${isActive ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]' : 'hover:bg-[var(--vscode-list-hoverBackground)]'}`}
                          >
                            <td className="p-3 text-xs font-medium flex items-center gap-2">
                              {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                              {!isActive && <div className="w-3.5 h-3.5" />}
                              {model.name}
                            </td>
                            <td className="p-3 text-xs">{fmt(reqs)}</td>
                            <td className="p-3 text-xs">{fmt(totalTokens)}</td>
                            <td className="p-3 text-xs">{avgDur.toFixed(1)}s</td>
                            <td className="p-3 text-xs">{avgTtft.toFixed(2)}s</td>
                            <td className={`p-3 text-xs text-right font-medium ${errRate > 0 ? 'text-red-400' : ''}`}>
                              {errRate.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Donut + Legend */}
          {chartData.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ArrowUpRight className="w-4 h-4 text-[var(--vscode-textLink-foreground)]" />
                <span className="font-bold text-sm text-[var(--vscode-foreground)]">Breakdown</span>
              </div>
              <div className="flex flex-col items-center gap-4 p-4 rounded-xl border border-[var(--vscode-widget-border)] bg-[var(--vscode-editorWidget-background)]">
                <DonutChart data={chartData} size={150} />
                <div className="w-full space-y-1.5">
                  {chartData.map((d) => (
                    <div key={d.label} className="flex items-center gap-2 text-[10px]">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <div className="flex-1 truncate text-[var(--vscode-descriptionForeground)]">{d.label}</div>
                      <div className="font-bold text-[var(--vscode-foreground)]">{totalTokens > 0 ? `${Math.round(d.value / totalTokens * 100)}%` : '0%'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prompt vs Output */}
              <div className="mt-4 p-4 rounded-xl border border-[var(--vscode-widget-border)] bg-[var(--vscode-editorWidget-background)]">
                <div className="font-bold text-xs text-[var(--vscode-foreground)] mb-3">Prompt vs Output</div>
                <DonutChart
                  data={[
                    { label: 'Prompt', value: totalPrompt, color: '#6366f1' },
                    { label: 'Output', value: totalCompletion, color: '#34d399' },
                  ]}
                  size={100}
                />
                <div className="mt-3 space-y-1.5">
                  {[
                    { label: 'Prompt Tokens', value: totalPrompt, color: '#6366f1' },
                    { label: 'Output Tokens', value: totalCompletion, color: '#34d399' },
                  ].map((d) => (
                    <div key={d.label} className="flex items-center gap-2 text-[10px]">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                      <div className="flex-1 text-[var(--vscode-descriptionForeground)]">{d.label}</div>
                      <div className="font-bold text-[var(--vscode-foreground)]">{fmt(d.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {chartData.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-[var(--vscode-widget-border)] bg-[var(--vscode-editorWidget-background)] text-center">
              <BarChart2 className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs text-[var(--vscode-descriptionForeground)]">Chat with a model to see token stats here!</p>
            </div>
          )}
        </div>

        {/* Graphs Section */}
        {config.models.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <LineChart 
              title="Avg Latency Trend"
              color="#f472b6"
              unit="Seconds"
              data={latencyChartData}
            />
            <LineChart 
              title="Request Tokens Trend"
              color="#38bdf8"
              unit="Tokens"
              data={tokenChartData}
            />
          </div>
        )}
      </div>
    </div>
  );
}
