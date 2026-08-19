import { useState, useEffect } from 'react';
import { vscode } from '../../vscode';
import { Settings, Server, Zap, MessageSquare } from 'lucide-react';

interface SettingsData {
  model?: string;
  enableGitSnapshots?: boolean;
  maxTokens?: number;
  temperature?: number;
  autoContextExtraction?: boolean;
  systemPrompt?: string;
  'autocomplete.enabled'?: boolean;
  'autocomplete.model'?: string;
  'autocomplete.debounceMs'?: number;
  'chat.historySize'?: number;
}

export default function SettingsView() {
  const [settings, setSettings] = useState<SettingsData | null>(null);

  useEffect(() => {
    vscode.postMessage({ type: 'getVscodeSettings' });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'vscodeSettingsResult') {
        setSettings(message.payload.settings);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleChange = (key: keyof SettingsData, value: any) => {
    // Optimistic update
    setSettings((prev) => (prev ? { ...prev, [key]: value } : null));
    
    // Save to VS Code
    vscode.postMessage({
      type: 'updateVscodeSetting',
      payload: { key, value }
    });
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <Settings className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto">
      <div className="max-w-4xl w-full mx-auto space-y-8 pb-10">
        
        {/* General Settings */}
        <section className="rounded-2xl shadow-sm border p-8 transition-colors" style={{ backgroundColor: 'var(--vscode-editorWidget-background)', borderColor: 'var(--vscode-widget-border)' }}>
          <div className="flex items-center gap-4 mb-6 border-b border-[var(--vscode-panel-border)] pb-5">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-purple-500 bg-purple-500/10 border border-purple-500/20">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--vscode-foreground)] tracking-tight">General Settings</h2>
              <p className="text-sm text-[var(--vscode-descriptionForeground)] mt-1">Global agent behaviors and features</p>
            </div>
          </div>
          
          <div className="space-y-6">
            
            <label className="flex items-center gap-4 cursor-pointer p-4 rounded-xl border border-[var(--vscode-widget-border)] hover:bg-[var(--vscode-list-hoverBackground)] transition-colors">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={settings.enableGitSnapshots !== false} // default true
                  onChange={(e) => handleChange('enableGitSnapshots', e.target.checked)}
                  className="w-5 h-5 rounded border-[var(--vscode-input-border)] text-[var(--vscode-button-background)] focus:ring-2 focus:ring-[var(--vscode-focusBorder)] bg-[var(--vscode-input-background)] cursor-pointer"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[var(--vscode-foreground)]">Enable Auto Git-Snapshots</span>
                <span className="text-xs text-[var(--vscode-descriptionForeground)]">Automatically creates a Git commit before AI runs commands or edits files. This enables the 'Revert' button in chat.</span>
              </div>
            </label>
          </div>
        </section>

        {/* MCP Settings */}
        <section className="rounded-2xl shadow-sm border p-8 transition-colors" style={{ backgroundColor: 'var(--vscode-editorWidget-background)', borderColor: 'var(--vscode-widget-border)' }}>
          <div className="flex items-center gap-4 mb-6 border-b border-[var(--vscode-panel-border)] pb-5">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-emerald-500 bg-emerald-500/10 border border-emerald-500/20">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--vscode-foreground)] tracking-tight">MCP Servers</h2>
              <p className="text-sm text-[var(--vscode-descriptionForeground)] mt-1">Model Context Protocol configuration</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="p-4 rounded-xl border border-[var(--vscode-widget-border)] bg-[var(--vscode-list-hoverBackground)]">
              <h3 className="text-sm font-semibold text-[var(--vscode-foreground)] mb-2">Workspace MCP Config</h3>
              <p className="text-xs text-[var(--vscode-descriptionForeground)] leading-relaxed">
                Chanakya AI Enhancer automatically supports the **Model Context Protocol (MCP)**. 
                To add custom tools (like Local DB, GitHub, Web Search), create a <code className="text-emerald-400 bg-black/20 px-1 rounded">.vscode/mcp.json</code> file in your workspace root.
              </p>
              <pre className="mt-3 p-3 rounded-lg bg-black/40 border border-white/5 text-[11px] font-mono text-emerald-300 overflow-x-auto">
{`{
  "mcpServers": {
    "sqlite": {
      "command": "uvx",
      "args": ["mcp-server-sqlite", "--db-path", "database.db"]
    }
  }
}`}
              </pre>
            </div>
          </div>
        </section>

        {/* Autocomplete Settings */}
        <section className="rounded-2xl shadow-sm border p-8 transition-colors" style={{ backgroundColor: 'var(--vscode-editorWidget-background)', borderColor: 'var(--vscode-widget-border)' }}>
          <div className="flex items-center gap-4 mb-6 border-b border-[var(--vscode-panel-border)] pb-5">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sky-500 bg-sky-500/10 border border-sky-500/20">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--vscode-foreground)] tracking-tight">Autocomplete (FIM)</h2>
              <p className="text-sm text-[var(--vscode-descriptionForeground)] mt-1">Ghost text inline autocomplete settings</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <label className="flex items-center gap-4 cursor-pointer p-4 rounded-xl border border-[var(--vscode-widget-border)] hover:bg-[var(--vscode-list-hoverBackground)] transition-colors">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={!!settings['autocomplete.enabled']}
                  onChange={(e) => handleChange('autocomplete.enabled', e.target.checked)}
                  className="w-5 h-5 rounded border-[var(--vscode-input-border)] text-[var(--vscode-button-background)] focus:ring-2 focus:ring-[var(--vscode-focusBorder)] bg-[var(--vscode-input-background)] cursor-pointer"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[var(--vscode-foreground)]">Enable Autocomplete</span>
                <span className="text-xs text-[var(--vscode-descriptionForeground)]">Turn on ghost text inline completion globally.</span>
              </div>
            </label>

            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[var(--vscode-foreground)]">Debounce (Ms)</label>
                <input
                  type="number"
                  value={settings['autocomplete.debounceMs'] || 300}
                  onChange={(e) => handleChange('autocomplete.debounceMs', parseInt(e.target.value, 10))}
                  className="px-4 py-3 rounded-lg border border-[var(--vscode-input-border)] focus:border-[var(--vscode-focusBorder)] focus:outline-none transition-colors bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] placeholder-[var(--vscode-input-placeholderForeground)]"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[var(--vscode-foreground)]">FIM Model</label>
                <input
                  type="text"
                  value={settings['autocomplete.model'] || ''}
                  onChange={(e) => handleChange('autocomplete.model', e.target.value)}
                  className="px-4 py-3 rounded-lg border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] opacity-70 cursor-not-allowed"
                  disabled
                  title="Configured in Models Hub"
                />
                <p className="text-[10px] text-[var(--vscode-descriptionForeground)] italic">Select FIM model from the Models Hub tab.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Chat Settings */}
        <section className="rounded-2xl shadow-sm border p-8 transition-colors" style={{ backgroundColor: 'var(--vscode-editorWidget-background)', borderColor: 'var(--vscode-widget-border)' }}>
          <div className="flex items-center gap-4 mb-6 border-b border-[var(--vscode-panel-border)] pb-5">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-emerald-500 bg-emerald-500/10 border border-emerald-500/20">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--vscode-foreground)] tracking-tight">Chat & Parameters</h2>
              <p className="text-sm text-[var(--vscode-descriptionForeground)] mt-1">Customize the chat experience and LLM defaults</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <label className="flex items-center gap-4 cursor-pointer p-4 rounded-xl border border-[var(--vscode-widget-border)] hover:bg-[var(--vscode-list-hoverBackground)] transition-colors">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={!!settings.autoContextExtraction}
                  onChange={(e) => handleChange('autoContextExtraction', e.target.checked)}
                  className="w-5 h-5 rounded border-[var(--vscode-input-border)] text-[var(--vscode-button-background)] focus:ring-2 focus:ring-[var(--vscode-focusBorder)] bg-[var(--vscode-input-background)] cursor-pointer"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[var(--vscode-foreground)]">Auto Context Extraction</span>
                <span className="text-xs text-[var(--vscode-descriptionForeground)]">Automatically extract surrounding code context from the active editor when sending chat messages.</span>
              </div>
            </label>

            <div className="grid grid-cols-3 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[var(--vscode-foreground)]">Max Tokens</label>
                <input
                  type="number"
                  value={settings.maxTokens || 4096}
                  onChange={(e) => handleChange('maxTokens', parseInt(e.target.value, 10))}
                  className="px-4 py-3 rounded-lg border border-[var(--vscode-input-border)] focus:border-[var(--vscode-focusBorder)] focus:outline-none transition-colors bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] placeholder-[var(--vscode-input-placeholderForeground)]"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[var(--vscode-foreground)]">Temperature</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.temperature || 0.1}
                  onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                  className="px-4 py-3 rounded-lg border border-[var(--vscode-input-border)] focus:border-[var(--vscode-focusBorder)] focus:outline-none transition-colors bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] placeholder-[var(--vscode-input-placeholderForeground)]"
                />
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[var(--vscode-foreground)]">History Size</label>
                <input
                  type="number"
                  value={settings['chat.historySize'] || 10}
                  onChange={(e) => handleChange('chat.historySize', parseInt(e.target.value, 10))}
                  className="px-4 py-3 rounded-lg border border-[var(--vscode-input-border)] focus:border-[var(--vscode-focusBorder)] focus:outline-none transition-colors bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] placeholder-[var(--vscode-input-placeholderForeground)]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--vscode-foreground)]">System Prompt</label>
              <textarea
                value={settings.systemPrompt || ''}
                onChange={(e) => handleChange('systemPrompt', e.target.value)}
                placeholder="You are an expert software engineer..."
                rows={4}
                className="px-4 py-3 rounded-lg border border-[var(--vscode-input-border)] focus:border-[var(--vscode-focusBorder)] focus:outline-none transition-colors bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] placeholder-[var(--vscode-input-placeholderForeground)] text-sm resize-y"
              />
              <p className="text-xs text-[var(--vscode-descriptionForeground)]">Custom system prompt to inject into chat requests.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
