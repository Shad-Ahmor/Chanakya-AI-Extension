import { useState, useEffect } from 'react';
import { AppConfig, ModelConfig } from '../../types/config';
import { vscode } from '../../vscode';
import ModelEditModal from './ModelEditModal';
import YAML from 'yaml';
import SettingsView from '../Settings/SettingsView';
import TokenOptimizerView from '../TokenOptimizer/TokenOptimizerView';
import AnalyticsDashboard from '../Analytics/AnalyticsDashboard';
import GraphifyView from '../Graphify/GraphifyView';
import McpHubView from '../McpHub/McpHubView';
import {
  Cpu,
  Globe,
  Plus,
  Radio,
  Zap,
  Edit2,
  Trash2,
  FileCode,
  RefreshCw,
  FolderOpen,
  MessageSquare,
  Search,
  Server,
  Settings,
  TrendingDown,
  BarChart2,
  Network,
} from 'lucide-react';

interface Props {
  config: AppConfig;
  rawYaml: string;
  onUpdateConfig: (newConfig: AppConfig, rawYaml?: string) => void;
  onClose: () => void;
  isDashboard?: boolean;
  initialDashboardTab?: 'visual' | 'yaml' | 'settings' | 'token_optimizer' | 'analytics' | 'graphify' | 'mcp';
}

export default function ModelHubView({ config, rawYaml, onUpdateConfig, onClose, isDashboard, initialDashboardTab }: Props) {
  const [activeTab, setActiveTab] = useState<'visual' | 'yaml' | 'settings' | 'token_optimizer' | 'analytics' | 'graphify' | 'mcp'>(initialDashboardTab || 'visual');
  const [filter, setFilter] = useState<'all' | 'local' | 'online' | 'chat' | 'autocomplete'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [yamlContent, setYamlContent] = useState(rawYaml);
  const [isScanning, setIsScanning] = useState(false);
  const [pingResults, setPingResults] = useState<Record<string, { success: boolean; latencyMs?: number; error?: string; loading?: boolean }>>({});



  useEffect(() => {
    if (initialDashboardTab) {
      setActiveTab(initialDashboardTab);
    }
  }, [initialDashboardTab]);

  const filteredModels = config.models.filter((m) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = (m.name || '').toLowerCase().includes(q) || (m.model || '').toLowerCase().includes(q) || (m.provider || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filter === 'local') return m.isLocal;
    if (filter === 'online') return !m.isLocal;
    if (filter === 'chat') return m.roles?.includes('chat');
    if (filter === 'autocomplete') return m.roles?.includes('autocomplete');
    return true;
  });

  const getBrandName = (provider: string = '', name: string = ''): string => {
    const p = (provider || '').toLowerCase();
    const n = (name || '').toLowerCase();
    if (n.includes('qwen') || p.includes('qwen')) return 'Qwen (Alibaba)';
    if (n.includes('claude') || p.includes('anthropic')) return 'Anthropic';
    if (n.includes('gemini') || p.includes('google')) return 'Google';
    if (n.includes('llama') || p.includes('meta')) return 'Meta';
    if (n.includes('mistral') || p.includes('mistral')) return 'Mistral AI';
    if (n.includes('deepseek') || p.includes('deepseek')) return 'DeepSeek';
    if (p.includes('openai')) return 'OpenAI';
    if (p.includes('ollama')) return 'Ollama';
    return provider;
  };

  const getProviderLogo = (provider: string = '', name: string = ''): string => {
    const p = (provider || '').toLowerCase();
    const n = (name || '').toLowerCase();
    // Name-based checks FIRST so Qwen-via-Ollama shows Qwen icon, not Ollama
    if (n.includes('qwen')) return 'https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@latest/light/qwen.png';
    if (n.includes('claude')) return 'https://upload.wikimedia.org/wikipedia/commons/7/78/Anthropic_logo.svg';
    if (n.includes('gemini')) return 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg';
    if (n.includes('llama')) return 'https://upload.wikimedia.org/wikipedia/commons/0/04/Meta_Platforms_Inc._logo.svg';
    if (n.includes('mistral')) return 'https://upload.wikimedia.org/wikipedia/commons/8/80/Mistral_AI_logo.svg';
    if (n.includes('deepseek')) return 'https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@latest/light/deepseek.png';
    // Provider-based checks as fallback
    if (p.includes('ollama')) return 'https://ollama.com/public/icon-64x64.png';
    if (p.includes('anthropic')) return 'https://upload.wikimedia.org/wikipedia/commons/7/78/Anthropic_logo.svg';
    if (p.includes('google')) return 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg';
    if (p.includes('meta')) return 'https://upload.wikimedia.org/wikipedia/commons/0/04/Meta_Platforms_Inc._logo.svg';
    if (p.includes('mistral')) return 'https://upload.wikimedia.org/wikipedia/commons/8/80/Mistral_AI_logo.svg';
    if (p.includes('qwen')) return 'https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@latest/light/qwen.png';
    if (p.includes('openai')) return 'https://upload.wikimedia.org/wikipedia/commons/4/4d/OpenAI_Logo.svg';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(getBrandName(provider, name))}&background=6366f1&color=fff&bold=true`;
  };

  const getModelKey = (m: ModelConfig): string => m.id || m.name;

  const handleTestPing = (model: ModelConfig) => {
    const key = getModelKey(model);
    setPingResults((prev) => ({
      ...prev,
      [key]: { success: false, loading: true }
    }));

    vscode.postMessage({
      type: 'testModelConnection',
      payload: { modelConfig: model }
    });

    setTimeout(() => {
      setPingResults((prev) => {
        if (prev[key]?.loading) {
          return {
            ...prev,
            [key]: { success: false, loading: false, error: 'Ping timed out (6s)' }
          };
        }
        return prev;
      });
    }, 6500);
  };

  const handleScanLocal = () => {
    setIsScanning(true);
    vscode.postMessage({ type: 'detectLocalModels' });
    setTimeout(() => setIsScanning(false), 3000);
  };

  const handleSetActiveChat = (idOrName: string) => {
    const updated: AppConfig = {
      ...config,
      activeChatModelId: idOrName
    };
    onUpdateConfig(updated);
  };

  const handleSetActiveAutocomplete = (idOrName: string) => {
    const updated: AppConfig = {
      ...config,
      activeAutocompleteModelId: idOrName
    };
    onUpdateConfig(updated);
  };

  const handleDeleteModel = (idOrName: string) => {
    if (config.models.length <= 1) {
      alert('You must have at least one configured model.');
      return;
    }
    const updatedModels = config.models.filter((m) => (m.id || m.name) !== idOrName);
    const updated: AppConfig = {
      ...config,
      models: updatedModels,
      activeChatModelId: config.activeChatModelId === idOrName ? (updatedModels[0]?.id || updatedModels[0]?.name) : config.activeChatModelId,
      activeAutocompleteModelId: config.activeAutocompleteModelId === idOrName ? (updatedModels[0]?.id || updatedModels[0]?.name) : config.activeAutocompleteModelId
    };
    onUpdateConfig(updated);
  };

  const handleSaveModel = (model: ModelConfig) => {
    let updatedModels: ModelConfig[];
    if (editingModel) {
      const editKey = getModelKey(editingModel);
      updatedModels = config.models.map((m) => (getModelKey(m) === editKey ? model : m));
    } else {
      updatedModels = [...config.models, model];
    }
    const updated: AppConfig = {
      ...config,
      models: updatedModels
    };
    onUpdateConfig(updated);
    setEditingModel(null);
    setIsAddingModel(false);
  };

  const handleSaveRawYaml = () => {
    try {
      const parsed = YAML.parse(yamlContent) as Partial<AppConfig>;
      if (!parsed || !Array.isArray(parsed.models)) {
        alert('Invalid YAML: "models" list is required.');
        return;
      }
      onUpdateConfig(parsed as AppConfig, yamlContent);
      alert('config.yaml saved successfully!');
    } catch (err: unknown) {
      alert(`YAML Parse Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };



  return (
    <div
      className={`flex flex-col h-full text-[13px] overflow-hidden ${isDashboard ? 'font-sans' : 'bg-vscode-bg text-vscode-fg'}`}
      style={isDashboard ? { backgroundColor: 'var(--vscode-editor-background)', color: 'var(--vscode-editor-foreground)' } : {}}
    >

      {/* Header Area */}
      {isDashboard ? (
        <div
          className="flex flex-col pt-10 pb-6 px-10 shadow-sm border-b shrink-0"
          style={{ backgroundColor: 'var(--vscode-editorWidget-background)', borderColor: 'var(--vscode-widget-border)' }}
        >
          <div className="flex items-start justify-between">
            <div className="max-w-xl">
              <h1 className="text-4xl font-extrabold tracking-tight mb-2" style={{ color: 'var(--vscode-editor-foreground)' }}>Chanakya AI Dashboard</h1>
              <p className="text-[var(--vscode-descriptionForeground)] text-base">A beautifully unified dashboard to configure models and IDE settings.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-[var(--vscode-input-background)] rounded-full border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] font-medium text-sm shadow-sm">
                <Globe className="w-4 h-4 text-emerald-500" />
                Network Standby
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-[var(--vscode-input-background)] rounded-full border border-[var(--vscode-input-border)] text-[var(--vscode-input-foreground)] font-medium text-sm shadow-sm">
                <Cpu className="w-4 h-4 text-purple-500" />
                System Ready
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-10">
            <div className="flex items-center gap-6 border-b w-full relative" style={{ borderColor: 'var(--vscode-widget-border)' }}>
              <button onClick={() => setActiveTab('analytics')} className={`pb-3 font-bold text-sm tracking-wide transition-colors ${activeTab === 'analytics' ? 'text-[var(--vscode-textLink-foreground)] border-b-2 border-[var(--vscode-textLink-foreground)]' : 'text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]'}`}>
                <div className="flex items-center gap-2"><BarChart2 className="w-4 h-4" /> Dashboard</div>
              </button>
              <button onClick={() => setActiveTab('graphify')} className={`pb-3 font-bold text-sm tracking-wide transition-colors ${activeTab === 'graphify' ? 'text-[var(--vscode-textLink-foreground)] border-b-2 border-[var(--vscode-textLink-foreground)]' : 'text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]'}`}>
                <div className="flex items-center gap-2"><Network className="w-4 h-4 text-cyan-400" /> Graphify Architecture</div>
              </button>
              <button onClick={() => setActiveTab('mcp')} className={`pb-3 font-bold text-sm tracking-wide transition-colors ${activeTab === 'mcp' ? 'text-[var(--vscode-textLink-foreground)] border-b-2 border-[var(--vscode-textLink-foreground)]' : 'text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]'}`}>
                <div className="flex items-center gap-2"><Server className="w-4 h-4 text-emerald-400" /> MCP Hub</div>
              </button>
              <button onClick={() => setActiveTab('visual')} className={`pb-3 font-bold text-sm tracking-wide transition-colors ${activeTab === 'visual' ? 'text-[var(--vscode-textLink-foreground)] border-b-2 border-[var(--vscode-textLink-foreground)]' : 'text-[var(--vscode-descriptionForeground)] hover:opacity-80'}`} style={activeTab !== 'visual' ? { color: 'var(--vscode-descriptionForeground)' } : {}}>
                <div className="flex items-center gap-2"><Zap className="w-4 h-4" /> Models Hub <span className="bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] px-2 py-0.5 rounded-full text-[10px] ml-1">{config.models.length}</span></div>
              </button>
              <button onClick={() => setActiveTab('settings')} className={`pb-3 font-bold text-sm tracking-wide transition-colors ${activeTab === 'settings' ? 'text-[var(--vscode-textLink-foreground)] border-b-2 border-[var(--vscode-textLink-foreground)]' : 'text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]'}`}>
                <div className="flex items-center gap-2"><Settings className="w-4 h-4" /> General Settings</div>
              </button>
              <button onClick={() => setActiveTab('token_optimizer')} className={`pb-3 font-bold text-sm tracking-wide transition-colors ${activeTab === 'token_optimizer' ? 'text-[var(--vscode-textLink-foreground)] border-b-2 border-[var(--vscode-textLink-foreground)]' : 'text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]'}`}>
                <div className="flex items-center gap-2"><TrendingDown className="w-4 h-4" /> Token Optimizer</div>
              </button>
              <button onClick={() => { setYamlContent(YAML.stringify(config)); setActiveTab('yaml'); }} className={`pb-3 font-bold text-sm tracking-wide transition-colors ${activeTab === 'yaml' ? 'text-[var(--vscode-textLink-foreground)] border-b-2 border-[var(--vscode-textLink-foreground)]' : 'text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]'}`}>
                <div className="flex items-center gap-2"><FileCode className="w-4 h-4" /> config.yaml</div>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-vscode-border bg-vscode-inputBg/40 select-none shrink-0">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-sky-400 animate-pulse" />
            <h2 className="font-bold text-sm tracking-wide text-white">Chanakya Model Hub</h2>
          </div>
          <div className="flex items-center gap-1 bg-vscode-bg border border-vscode-border rounded-lg p-0.5">
            <button onClick={() => setActiveTab('visual')} className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${activeTab === 'visual' ? 'bg-vscode-buttonBg text-vscode-buttonFg shadow-sm' : 'text-vscode-fg/70 hover:text-white'}`}>Visual Grid</button>
            <button onClick={() => setActiveTab('mcp')} className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${activeTab === 'mcp' ? 'bg-vscode-buttonBg text-vscode-buttonFg shadow-sm' : 'text-vscode-fg/70 hover:text-white'}`}>MCP Hub</button>
            <button onClick={() => { setYamlContent(YAML.stringify(config)); setActiveTab('yaml'); }} className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition ${activeTab === 'yaml' ? 'bg-vscode-buttonBg text-vscode-buttonFg shadow-sm' : 'text-vscode-fg/70 hover:text-white'}`}><FileCode className="w-3.5 h-3.5" /><span>config.yaml</span></button>
          </div>
          <button onClick={onClose} className="px-2.5 py-1 rounded-md border border-vscode-border hover:bg-white/10 text-xs transition">Back to Chat</button>
        </div>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 overflow-hidden flex flex-col ${isDashboard ? 'p-10' : 'p-3'}`}>

        {activeTab === 'graphify' ? (
          <div className="flex-1 -m-10 h-[calc(100%+80px)] overflow-hidden">
            <GraphifyView />
          </div>
        ) : activeTab === 'mcp' ? (
          <div className="flex-1 -m-10 h-[calc(100%+80px)] overflow-hidden">
            <McpHubView />
          </div>
        ) : activeTab === 'settings' ? (
          <SettingsView />
        ) : activeTab === 'token_optimizer' ? (
          <TokenOptimizerView config={config} />
        ) : activeTab === 'analytics' ? (
          <AnalyticsDashboard
            config={config}
            onSetActiveModel={(modelId) => {
              const newConfig = { ...config, activeChatModelId: modelId };
              onUpdateConfig(newConfig);
            }}
          />
        ) : activeTab === 'visual' ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">

            {/* Toolbar */}
            <div className={`flex items-center justify-between mb-6 shrink-0 ${isDashboard ? '' : 'flex-col gap-2'}`}>
              <div className={`flex items-center gap-3 ${isDashboard ? 'w-1/3' : 'w-full'}`}>
                <div className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border ${isDashboard ? 'bg-[var(--vscode-input-background)] border-[var(--vscode-input-border)] shadow-sm' : 'bg-vscode-inputBg border-vscode-inputBorder'}`}>
                  <Search className={`w-4 h-4 ${isDashboard ? 'text-[var(--vscode-descriptionForeground)]' : 'text-vscode-fg/50'}`} />
                  <input
                    type="text"
                    placeholder="Search models..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`bg-transparent outline-none w-full text-sm ${isDashboard ? 'text-[var(--vscode-input-foreground)]' : 'text-vscode-inputFg'}`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className={`flex items-center p-1 rounded-xl border ${isDashboard ? 'bg-[var(--vscode-editorWidget-background)] border-[var(--vscode-widget-border)] shadow-sm' : 'border-vscode-border bg-vscode-inputBg'}`}>
                  {(['all', 'local', 'online'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition ${filter === f
                          ? (isDashboard ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]' : 'bg-sky-500/20 text-sky-300 border border-sky-400')
                          : (isDashboard ? 'text-[var(--vscode-foreground)] hover:text-[var(--vscode-button-hoverBackground)]' : 'text-vscode-fg/60 hover:text-white')
                        }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <button onClick={handleScanLocal} disabled={isScanning} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition shadow-sm ${isDashboard ? 'bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/20'}`}>
                  <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                  Scan Local
                </button>
                <button onClick={() => setIsAddingModel(true)} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition shadow-sm ${isDashboard ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]' : 'bg-vscode-buttonBg text-vscode-buttonFg hover:bg-vscode-buttonHover'}`}>
                  <Plus className="w-4 h-4" />
                  Add Custom
                </button>
              </div>
            </div>


            {/* Grid — fixed row height so all cards are equal */}
            <div className={`flex-1 overflow-y-auto pr-2 pb-10 ${isDashboard ? 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 auto-rows-[260px]' : 'flex flex-col gap-3'}`}>
              {filteredModels.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center p-12 text-slate-400">
                  <Search className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No models found</p>
                </div>
              ) : (
                filteredModels.map((m, idx) => {
                  const modelKey = getModelKey(m);
                  const isChatActive = config.activeChatModelId === m.id || config.activeChatModelId === m.name;
                  const isFimActive = config.activeAutocompleteModelId === m.id || config.activeAutocompleteModelId === m.name;
                  const ping = pingResults[modelKey];
                  const isEnterprise = m.requestOptions?.headers && Object.keys(m.requestOptions.headers).length > 0;

                  // Dashboard styling overrides
                  const dashBorders = [
                    'border-t-purple-500',
                    'border-t-emerald-500',
                    'border-t-sky-500',
                    'border-t-amber-500',
                    'border-t-rose-500'
                  ];
                  const borderCls = dashBorders[idx % dashBorders.length];

                  if (isDashboard) {
                    return (
                      <div key={modelKey} className={`relative flex flex-col h-full p-4 rounded-xl shadow-sm transition-transform hover:-translate-y-1 overflow-hidden group border-t-[3px] border-b border-l border-r ${borderCls}`} style={{ backgroundColor: 'var(--vscode-editorWidget-background)', borderBottomColor: 'var(--vscode-widget-border)', borderLeftColor: 'var(--vscode-widget-border)', borderRightColor: 'var(--vscode-widget-border)' }}>
                        <div className="flex justify-between items-start mb-3 relative z-10">
                          <div className="flex items-center gap-3">
                            <img
                              src={getProviderLogo(m.provider, m.name)}
                              alt={getBrandName(m.provider, m.name)}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getBrandName(m.provider, m.name))}&background=6366f1&color=fff&bold=true`;
                              }}
                              className="w-10 h-10 rounded-full object-contain p-1.5 bg-white shadow-sm border border-[var(--vscode-widget-border)]"
                            />
                            <div className="flex flex-col justify-center">
                              <h3 className="font-bold text-sm tracking-tight leading-tight max-w-[120px] truncate text-[var(--vscode-foreground)]">{m.name}</h3>
                              <p className="text-[10px] font-semibold opacity-70 uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">{getBrandName(m.provider, m.name)}</p>
                            </div>
                          </div>

                          <div className="flex gap-1">
                            <button onClick={() => handleTestPing(m)} title="Test Connection" className="p-1 rounded-md bg-[var(--vscode-button-secondaryBackground)] hover:bg-emerald-500 hover:text-white text-[var(--vscode-button-secondaryForeground)] transition">
                              <RefreshCw className={`w-3 h-3 ${ping?.loading ? 'animate-spin' : ''}`} />
                            </button>
                            <button onClick={() => setEditingModel(m)} title="Edit Model" className="p-1 rounded-md bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] text-[var(--vscode-button-secondaryForeground)] transition">
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleDeleteModel(m.id || m.name)} title="Delete Model" className="p-1 rounded-md bg-[var(--vscode-button-secondaryBackground)] hover:bg-red-500 hover:text-white transition">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1 mb-3 relative z-10">
                          {m.roles?.map(r => (
                            <span key={r} className="px-1.5 py-0.5 rounded-md bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] text-[9px] font-bold uppercase tracking-widest">{r}</span>
                          ))}
                          {m.isLocal && <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1"><Cpu className="w-2.5 h-2.5" /> Local</span>}
                          {isEnterprise && <span className="px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-500 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1"><Server className="w-2.5 h-2.5" /> Ent</span>}
                        </div>

                        <div className="bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded-lg p-2.5 mb-4 font-mono text-[10px] space-y-1.5 relative z-10">
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--vscode-descriptionForeground)] uppercase text-[9px] font-bold">Model ID</span>
                            <span className="truncate max-w-[90px] text-[var(--vscode-foreground)]">{m.model}</span>
                          </div>
                          {m.apiBase && (
                            <div className="flex items-center justify-between">
                              <span className="text-[var(--vscode-descriptionForeground)] uppercase text-[9px] font-bold">Endpoint</span>
                              <span className="truncate max-w-[90px] text-[var(--vscode-foreground)]">{m.apiBase}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--vscode-descriptionForeground)] uppercase text-[9px] font-bold">Ping</span>
                            <div className="flex items-center gap-1 text-[var(--vscode-foreground)]">
                              <button onClick={() => handleTestPing(m)} disabled={ping?.loading} className="hover:opacity-80 transition text-[var(--vscode-textLink-foreground)]">
                                <RefreshCw className={`w-2.5 h-2.5 ${ping?.loading ? 'animate-spin' : ''}`} />
                              </button>
                              <span>{ping?.loading ? '...' : ping?.success ? `${ping.latencyMs}ms` : ping?.error ? 'Offline' : 'Untested'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-auto space-y-1.5 relative z-10">
                          {isChatActive ? (
                            <div className="w-full py-1.5 rounded-lg bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] text-center font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm">
                              <MessageSquare className="w-3.5 h-3.5" /> Active Chat
                            </div>
                          ) : (
                            (m.roles?.includes('chat') ?? true) && (
                              <button onClick={() => handleSetActiveChat(m.id || m.name)} className="w-full py-1.5 rounded-lg bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] text-center font-semibold text-[11px] flex items-center justify-center gap-1.5 transition border border-[var(--vscode-button-secondaryBackground)] hover:border-[var(--vscode-button-secondaryHoverBackground)]">
                                <MessageSquare className="w-3.5 h-3.5" /> Set Chat
                              </button>
                            )
                          )}

                          {isFimActive ? (
                            <div className="w-full py-1.5 rounded-lg bg-purple-600 text-white text-center font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm">
                              <Zap className="w-3.5 h-3.5" /> Active FIM
                            </div>
                          ) : (
                            (m.roles?.includes('autocomplete') ?? false) && (
                              <button onClick={() => handleSetActiveAutocomplete(m.id || m.name)} className="w-full py-1.5 rounded-lg bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] text-center font-semibold text-[11px] flex items-center justify-center gap-1.5 transition border border-[var(--vscode-button-secondaryBackground)] hover:border-[var(--vscode-button-secondaryHoverBackground)]">
                                <Zap className="w-3.5 h-3.5" /> Set FIM
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Non-dashboard rendering (sidebar style)
                  return (
                    <div key={modelKey} className={`flex flex-col p-3.5 rounded-xl border transition-all ${isChatActive ? 'border-vscode-focusBorder bg-vscode-list-activeSelectionBackground/10 shadow-lg' : isFimActive ? 'border-purple-500/50 bg-purple-500/5 shadow-md' : 'border-vscode-border bg-vscode-editor-background hover:border-vscode-focusBorder/50'}`}>
                      {/* Top Row: Name, Provider Badge, Local/Online */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-2 max-w-full">
                          <span className="font-bold text-sm text-vscode-fg truncate max-w-full">{m.name}</span>
                          {m.isLocal ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium whitespace-nowrap"><Cpu className="w-3 h-3" /> Local Runner</span>
                          ) : isEnterprise ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-medium whitespace-nowrap"><Server className="w-3 h-3" /> Enterprise Foundry</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-medium whitespace-nowrap"><Globe className="w-3 h-3" /> Online API</span>
                          )}
                        </div>

                        {/* Active Status Badges */}
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          {isChatActive && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-vscode-buttonBg text-vscode-buttonFg shadow-sm">Active Chat</span>}
                          {isFimActive && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-600 text-white shadow-sm">Active FIM</span>}
                        </div>
                      </div>

                      {/* Model Details */}
                      <div className="font-mono text-[11px] text-vscode-fg/70 space-y-1 mb-3">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-vscode-fg/50">Model:</span>
                          <span className="text-vscode-textLinkForeground font-semibold break-all">{m.model}</span>
                          <span className="text-vscode-fg/50">Provider:</span>
                          <span className="uppercase text-[var(--vscode-foreground)]">{getBrandName(m.provider, m.name)}</span>
                        </div>
                        {m.apiBase && <div className="text-vscode-fg/60 flex items-start gap-1"><span className="text-vscode-fg/50 flex-shrink-0">Endpoint:</span> <span className="break-all">{m.apiBase}</span></div>}
                      </div>

                      {/* Card Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 select-none">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {!isChatActive && (m.roles?.includes('chat') ?? true) && (
                            <button onClick={() => handleSetActiveChat(m.id || m.name)} className="flex items-center gap-1 px-2 py-1 rounded bg-vscode-inputBg hover:bg-vscode-list-hoverBackground text-vscode-textLinkForeground text-[11px] border border-vscode-border transition font-medium whitespace-nowrap"><MessageSquare className="w-3 h-3" /><span>Set Chat</span></button>
                          )}
                          {!isFimActive && (m.roles?.includes('autocomplete') ?? false) && (
                            <button onClick={() => handleSetActiveAutocomplete(m.id || m.name)} className="flex items-center gap-1 px-2 py-1 rounded bg-vscode-inputBg hover:bg-vscode-list-hoverBackground text-purple-600 dark:text-purple-400 text-[11px] border border-vscode-border transition font-medium whitespace-nowrap"><Zap className="w-3 h-3" /><span>Set FIM</span></button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setEditingModel(m)} title="Edit Model" className="p-1 rounded hover:bg-vscode-toolbar-hoverBackground text-vscode-fg/70 hover:text-vscode-fg transition"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteModel(m.id || m.name)} title="Delete Model" className="p-1 rounded hover:bg-red-500/10 text-vscode-fg/50 hover:text-red-500 dark:hover:text-red-400 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden h-full">
            <div className={`flex items-center justify-between text-sm ${isDashboard ? 'text-[var(--vscode-descriptionForeground)]' : 'text-vscode-fg/70'}`}>
              <span>Directly edit your <code className={`px-1.5 py-0.5 rounded ${isDashboard ? 'bg-[var(--vscode-textCodeBlock-background)]' : 'bg-white/10'}`}>config.yaml</code> file:</span>
              <button onClick={() => vscode.postMessage({ type: 'openConfigFile' })} className="flex items-center gap-2 text-[var(--vscode-textLink-foreground)] hover:text-[var(--vscode-textLink-activeForeground)] font-bold transition">
                <FolderOpen className="w-4 h-4" /> Open in VS Code Editor
              </button>
            </div>
            <textarea
              value={yamlContent}
              onChange={(e) => setYamlContent(e.target.value)}
              className={`flex-1 rounded-xl p-4 font-mono text-[13px] leading-relaxed outline-none resize-none shadow-inner border transition ${isDashboard ? 'bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border-[var(--vscode-input-border)] focus:border-[var(--vscode-focusBorder)]' : 'bg-vscode-inputBg text-vscode-inputFg border-vscode-inputBorder focus:border-sky-500'}`}
            />
            <div className="flex justify-end gap-3 pt-2 select-none shrink-0">
              <button onClick={() => setYamlContent(YAML.stringify(config))} className={`px-5 py-2 rounded-xl font-bold transition ${isDashboard ? 'text-[var(--vscode-foreground)] bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]' : 'border border-vscode-border hover:bg-white/10'}`}>Reset Changes</button>
              <button onClick={handleSaveRawYaml} className={`px-6 py-2 rounded-xl font-bold transition shadow-lg ${isDashboard ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]' : 'bg-vscode-buttonBg hover:bg-vscode-buttonHover'}`}>Save YAML</button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {(editingModel || isAddingModel) && (
        <ModelEditModal
          key={editingModel?.id || editingModel?.name || 'new-model'}
          model={editingModel}
          onSave={handleSaveModel}
          onClose={() => { setEditingModel(null); setIsAddingModel(false); }}
        />
      )}
    </div>
  );
}
