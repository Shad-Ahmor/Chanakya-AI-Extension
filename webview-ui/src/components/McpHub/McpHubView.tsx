import { useState, useEffect } from 'react';
import { vscode } from '../../vscode';
import {
  McpServerInfo,
  McpToolExecutionLog,
  McpPreset,
  McpServerConfig,
  McpToolDefinition
} from '../../types/mcp';
import { MCP_PRESETS } from './mcpPresets';
import {
  Server,
  Plus,
  RefreshCw,
  Play,
  Trash2,
  Power,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Code,
  Database,
  Globe,
  Brain,
  Folder,
  Sparkles,
  Cpu,
  Search,
  BookOpen
} from 'lucide-react';

export default function McpHubView() {
  const [servers, setServers] = useState<McpServerInfo[]>([]);
  const [logs, setLogs] = useState<McpToolExecutionLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'servers' | 'tools' | 'marketplace' | 'logs' | 'instructions'>('servers');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add Custom Server Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newServerName, setNewServerName] = useState<string>('');
  const [newServerType, setNewServerType] = useState<'stdio' | 'sse'>('stdio');
  const [newServerCommand, setNewServerCommand] = useState<string>('npx');
  const [newServerArgs, setNewServerArgs] = useState<string>('-y @modelcontextprotocol/server-memory');
  const [newServerUrl, setNewServerUrl] = useState<string>('');
  const [newServerEnv, setNewServerEnv] = useState<string>('');

  // Preset Install Modal
  const [selectedPreset, setSelectedPreset] = useState<McpPreset | null>(null);
  const [presetFieldValues, setPresetFieldValues] = useState<Record<string, string>>({});

  // Tool Runner State
  const [selectedTool, setSelectedTool] = useState<{ serverName: string; tool: McpToolDefinition } | null>(null);
  const [toolInputJson, setToolInputJson] = useState<string>('{}');
  const [toolResult, setToolResult] = useState<{ result?: string; error?: string; latencyMs?: number } | null>(null);
  const [isRunningTool, setIsRunningTool] = useState<boolean>(false);

  useEffect(() => {
    fetchData();

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'mcpHubDataResult') {
        setServers(msg.payload.servers || []);
        setLogs(msg.payload.logs || []);
        setLoading(false);
      } else if (msg.type === 'mcpToolTestResult') {
        setToolResult({
          result: msg.payload.result,
          error: msg.payload.error,
          latencyMs: msg.payload.latencyMs
        });
        setIsRunningTool(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchData = () => {
    setLoading(true);
    vscode.postMessage({ type: 'getMcpHubData' });
  };

  const handleToggleServer = (name: string, currentStatus: string) => {
    const enabled = currentStatus === 'offline';
    vscode.postMessage({
      type: 'toggleMcpServer',
      payload: { name, enabled }
    });
  };

  const handleRemoveServer = (name: string) => {
    vscode.postMessage({
      type: 'removeMcpServer',
      payload: { name }
    });
  };

  const handlePingServer = (name: string) => {
    vscode.postMessage({
      type: 'pingMcpServer',
      payload: { name }
    });
  };

  const handleAddCustomServer = () => {
    if (!newServerName.trim()) return;

    let envObj: Record<string, string> | undefined;
    if (newServerEnv.trim()) {
      try {
        envObj = JSON.parse(newServerEnv);
      } catch {
        envObj = {};
      }
    }

    const config: McpServerConfig = {
      type: newServerType,
      command: newServerType === 'stdio' ? newServerCommand.trim() : undefined,
      args: newServerType === 'stdio' ? newServerArgs.split(/\s+/).filter(Boolean) : undefined,
      url: newServerType === 'sse' ? newServerUrl.trim() : undefined,
      env: envObj
    };

    vscode.postMessage({
      type: 'addMcpServer',
      payload: { name: newServerName.trim(), config }
    });

    setIsAddModalOpen(false);
    setNewServerName('');
    setNewServerUrl('');
  };

  const handleInstallPreset = (preset: McpPreset) => {
    if (preset.requiresConfig && preset.configFields) {
      setSelectedPreset(preset);
      setPresetFieldValues({});
    } else {
      // Install directly
      vscode.postMessage({
        type: 'addMcpServer',
        payload: {
          name: preset.id,
          config: {
            command: preset.command,
            args: preset.args,
            env: preset.env
          }
        }
      });
      setActiveTab('servers');
    }
  };

  const handleConfirmPresetInstall = () => {
    if (!selectedPreset) return;

    let finalArgs = [...selectedPreset.args];
    let finalEnv = { ...(selectedPreset.env || {}) };

    if (selectedPreset.id === 'sqlite' && presetFieldValues.dbPath) {
      finalArgs = ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', presetFieldValues.dbPath];
    } else if (selectedPreset.id === 'postgres' && presetFieldValues.connectionString) {
      finalArgs = ['-y', '@modelcontextprotocol/server-postgres', presetFieldValues.connectionString];
    } else if (selectedPreset.id === 'github' && presetFieldValues.GITHUB_PERSONAL_ACCESS_TOKEN) {
      finalEnv['GITHUB_PERSONAL_ACCESS_TOKEN'] = presetFieldValues.GITHUB_PERSONAL_ACCESS_TOKEN;
    } else if (selectedPreset.id === 'brave-search' && presetFieldValues.BRAVE_API_KEY) {
      finalEnv['BRAVE_API_KEY'] = presetFieldValues.BRAVE_API_KEY;
    }

    vscode.postMessage({
      type: 'addMcpServer',
      payload: {
        name: selectedPreset.id,
        config: {
          command: selectedPreset.command,
          args: finalArgs,
          env: Object.keys(finalEnv).length > 0 ? finalEnv : undefined
        }
      }
    });

    setSelectedPreset(null);
    setActiveTab('servers');
  };

  const handleSelectToolForRunner = (serverName: string, tool: McpToolDefinition) => {
    setSelectedTool({ serverName, tool });
    setToolResult(null);

    // Build default JSON template from properties
    const defaultObj: Record<string, any> = {};
    if (tool.inputSchema?.properties) {
      for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
        defaultObj[key] = (prop as any).type === 'number' ? 0 : (prop as any).type === 'boolean' ? true : '';
      }
    }
    setToolInputJson(JSON.stringify(defaultObj, null, 2));
    setActiveTab('tools');
  };

  const handleExecuteTool = () => {
    if (!selectedTool) return;

    let parsedArgs: Record<string, any> = {};
    try {
      parsedArgs = JSON.parse(toolInputJson);
    } catch {
      setToolResult({ error: 'Invalid JSON in input parameters' });
      return;
    }

    setIsRunningTool(true);
    setToolResult(null);

    vscode.postMessage({
      type: 'testMcpTool',
      payload: {
        serverName: selectedTool.serverName,
        toolName: selectedTool.tool.name,
        args: parsedArgs
      }
    });
  };

  const allTools = servers.flatMap((s) => s.tools.map((t) => ({ serverName: s.name, tool: t })));
  const filteredTools = allTools.filter(
    (t) =>
      t.tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.serverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.tool.description && t.tool.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col w-full h-full bg-[#0a0a12] text-slate-100 font-sans overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#12121f] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-white flex items-center gap-2">
              Model Context Protocol (MCP) Hub
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                Active ({servers.filter((s) => s.status === 'connected').length}/{servers.length})
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Manage local & remote MCP servers, tools, memory database, and external tool integrations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition"
            title="Refresh MCP Servers"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold transition shadow-md shadow-emerald-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Server</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-white/10 bg-[#0e0e18] text-xs font-medium shrink-0">
        <button
          onClick={() => setActiveTab('servers')}
          className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === 'servers'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Connected Servers ({servers.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('tools')}
          className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === 'tools'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Code className="w-3.5 h-3.5" />
          <span>Tools & Live Runner ({allTools.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('marketplace')}
          className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === 'marketplace'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>1-Click Marketplace</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === 'logs'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Database & Execution Logs ({logs.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('instructions')}
          className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ml-auto ${
            activeTab === 'instructions'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-sky-400" />
          <span>Instructions & Guide</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Tab 1: Connected Servers */}
        {activeTab === 'servers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {servers.map((server) => {
              const isEmbedded = server.type === 'embedded';
              const isConnected = server.status === 'connected';

              return (
                <div
                  key={server.id}
                  className="p-4 rounded-xl bg-[#121222] border border-white/10 flex flex-col justify-between gap-3 hover:border-emerald-500/30 transition shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className={`p-2 rounded-lg ${
                          isEmbedded
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : isConnected
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isEmbedded ? <Cpu className="w-4 h-4" /> : <Server className="w-4 h-4" />}
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-xs text-white truncate flex items-center gap-1.5">
                          {server.name}
                          {isEmbedded && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 uppercase tracking-wider font-mono">
                              Built-in
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                          {server.type} transport
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                        isConnected
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : server.status === 'connecting'
                          ? 'bg-amber-500/20 text-amber-300 animate-pulse'
                          : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {isConnected ? (
                        <CheckCircle2 className="w-2.5 h-2.5" />
                      ) : (
                        <AlertCircle className="w-2.5 h-2.5" />
                      )}
                      <span>{server.status}</span>
                    </div>
                  </div>

                  {/* Capabilities Summary */}
                  <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-black/40 border border-white/5 text-center text-[10px]">
                    <div>
                      <div className="font-bold text-slate-200 text-xs">{server.tools.length}</div>
                      <div className="text-slate-500">Tools</div>
                    </div>
                    <div>
                      <div className="font-bold text-slate-200 text-xs">{server.resources.length}</div>
                      <div className="text-slate-500">Resources</div>
                    </div>
                    <div>
                      <div className="font-bold text-slate-200 text-xs">
                        {server.latencyMs ? `${server.latencyMs}ms` : '--'}
                      </div>
                      <div className="text-slate-500">Latency</div>
                    </div>
                  </div>

                  {/* Error display if any */}
                  {server.error && (
                    <div className="text-[10px] text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20 truncate">
                      {server.error}
                    </div>
                  )}

                  {/* Server Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <button
                      onClick={() => handlePingServer(server.id)}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition"
                      title="Ping server"
                    >
                      <Clock className="w-3 h-3" />
                      <span>Ping</span>
                    </button>

                    {!isEmbedded && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleServer(server.id, server.status)}
                          className={`p-1.5 rounded-lg transition ${
                            isConnected
                              ? 'text-amber-400 hover:bg-amber-500/20'
                              : 'text-emerald-400 hover:bg-emerald-500/20'
                          }`}
                          title={isConnected ? 'Disable Server' : 'Enable Server'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveServer(server.id)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition"
                          title="Remove Server"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Tools & Live Interactive Runner */}
        {activeTab === 'tools' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
            {/* Left: Tool List */}
            <div className="lg:col-span-5 flex flex-col gap-2.5 overflow-hidden">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search MCP tools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[650px]">
                {filteredTools.map((item, idx) => {
                  const isSelected =
                    selectedTool?.serverName === item.serverName && selectedTool?.tool.name === item.tool.name;

                  return (
                    <div
                      key={idx}
                      onClick={() => handleSelectToolForRunner(item.serverName, item.tool)}
                      className={`p-3 rounded-lg border cursor-pointer transition flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-white'
                          : 'bg-[#121222] border-white/5 text-slate-300 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-emerald-300 font-mono">{item.tool.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-slate-400 font-mono">
                          {item.serverName}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {item.tool.description || 'No description provided.'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Interactive Live Tool Runner */}
            <div className="lg:col-span-7 flex flex-col gap-3 p-4 rounded-xl bg-[#121222] border border-white/10">
              {selectedTool ? (
                <>
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-2">
                        <span>{selectedTool.tool.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                          {selectedTool.serverName}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{selectedTool.tool.description}</p>
                    </div>
                    <button
                      onClick={handleExecuteTool}
                      disabled={isRunningTool}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition shadow-md shadow-emerald-500/20 disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isRunningTool ? 'Executing...' : 'Run Tool'}</span>
                    </button>
                  </div>

                  {/* Parameter Input JSON */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      Input Arguments (JSON):
                    </label>
                    <textarea
                      value={toolInputJson}
                      onChange={(e) => setToolInputJson(e.target.value)}
                      rows={6}
                      className="w-full p-3 bg-black/60 border border-white/10 rounded-lg text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  {/* Result Output */}
                  <div className="flex-1 flex flex-col gap-1.5 mt-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      <span>Execution Result:</span>
                      {toolResult?.latencyMs && (
                        <span className="text-slate-400 font-mono">{toolResult.latencyMs}ms</span>
                      )}
                    </div>
                    <div className="flex-1 min-h-[160px] p-3 bg-black/80 border border-white/10 rounded-lg text-xs font-mono overflow-auto max-h-[300px]">
                      {toolResult ? (
                        toolResult.error ? (
                          <span className="text-red-400">{toolResult.error}</span>
                        ) : (
                          <pre className="text-slate-200 whitespace-pre-wrap">{toolResult.result}</pre>
                        )
                      ) : (
                        <span className="text-slate-600">Click 'Run Tool' to test tool execution live...</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500 gap-2">
                  <Code className="w-10 h-10 text-slate-600" />
                  <span className="text-xs">Select any MCP tool from the left list to test it live.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: 1-Click Marketplace */}
        {activeTab === 'marketplace' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MCP_PRESETS.map((preset) => {
              const isAlreadyInstalled = servers.some((s) => s.id === preset.id || s.name === preset.id);

              return (
                <div
                  key={preset.id}
                  className="p-4 rounded-xl bg-[#121222] border border-white/10 flex flex-col justify-between gap-3 hover:border-amber-500/30 transition shadow-lg"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                      {preset.category === 'database' ? (
                        <Database className="w-5 h-5" />
                      ) : preset.category === 'memory' ? (
                        <Brain className="w-5 h-5" />
                      ) : preset.category === 'filesystem' ? (
                        <Folder className="w-5 h-5" />
                      ) : (
                        <Globe className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-white">{preset.name}</h3>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{preset.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-[10px] text-slate-500 font-mono">{preset.command}</span>
                    <button
                      onClick={() => handleInstallPreset(preset)}
                      disabled={isAlreadyInstalled}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        isAlreadyInstalled
                          ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                          : 'bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-500/20'
                      }`}
                    >
                      {isAlreadyInstalled ? 'Installed' : 'Connect'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 4: Database & Execution Logs */}
        {activeTab === 'logs' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Persistent execution history and latency benchmarks recorded in MCP Database.
              </span>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#121222] overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-black/40 border-b border-white/10 text-slate-400 font-mono text-[10px] uppercase">
                    <th className="p-3">Time</th>
                    <th className="p-3">Server</th>
                    <th className="p-3">Tool</th>
                    <th className="p-3">Latency</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Arguments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {logs.length > 0 ? (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/5 transition">
                        <td className="p-3 font-mono text-[10px] text-slate-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="p-3 font-mono text-emerald-400">{log.serverName}</td>
                        <td className="p-3 font-bold text-white font-mono">{log.toolName}</td>
                        <td className="p-3 font-mono text-slate-400">{log.latencyMs}ms</td>
                        <td className="p-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              log.success ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                            }`}
                          >
                            {log.success ? 'SUCCESS' : 'FAILED'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[10px] text-slate-400 max-w-xs truncate">
                          {JSON.stringify(log.args)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 text-xs">
                        No MCP tool calls recorded yet. Execute tools or ask Chanakya AI to generate logs.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Instructions */}
        {activeTab === 'instructions' && (
          <div className="space-y-6 text-sm text-slate-300 max-w-4xl mx-auto pb-10">
            {/* What is MCP? */}
            <div className="bg-[#121222] border border-white/10 rounded-xl p-6 shadow-lg">
              <h3 className="text-emerald-400 font-bold text-lg mb-2 flex items-center gap-2">
                <Brain className="w-5 h-5" /> What is Model Context Protocol (MCP)?
              </h3>
              <p className="mb-4 text-xs leading-relaxed">
                Imagine you have a really smart AI assistant, but it's locked in a room with no internet and no access to your files. It's smart, but it can't actually <strong>do</strong> anything for you.
              </p>
              <p className="text-xs leading-relaxed">
                <strong>MCP is like giving the AI hands, eyes, and internet access.</strong> It is a standard way to connect AI models to external tools, databases, and APIs securely. By setting up MCP, you let the AI read your databases, search the web, check GitHub, and execute real actions right from VS Code!
              </p>
            </div>

            {/* Core Concepts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#121222] border border-white/10 rounded-xl p-5 hover:border-emerald-500/30 transition">
                <h4 className="text-white font-bold mb-2 flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-500" /> What is an MCP Server?
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  An MCP Server is a tiny background program that acts as a bridge. For example, a "GitHub MCP Server" connects the AI to GitHub. The AI talks to the server, and the server securely talks to GitHub on your behalf.
                </p>
              </div>

              <div className="bg-[#121222] border border-white/10 rounded-xl p-5 hover:border-amber-500/30 transition">
                <h4 className="text-white font-bold mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-500" /> What is an MCP Database?
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Some MCP servers (like Memory servers) need a place to remember things so the AI doesn't forget details across chats. An MCP DB (like SQLite) stores this memory locally on your computer securely so it never leaks online.
                </p>
              </div>
            </div>

            {/* Transport Types & Environments */}
            <div className="bg-[#121222] border border-white/10 rounded-xl p-6 shadow-lg">
              <h3 className="text-white font-bold text-base mb-4">How do they connect? (Transport Types)</h3>
              
              <div className="space-y-4">
                <div className="bg-black/30 p-4 rounded-lg border border-white/5">
                  <h5 className="text-emerald-400 font-semibold mb-1 flex items-center gap-2 text-sm">
                    <Code className="w-4 h-4" /> STDIO (Local Server)
                  </h5>
                  <p className="text-xs text-slate-400 mb-2">
                    Runs directly on your computer. It uses standard input/output (like terminal commands). This is the most common and secure way because data never leaves your machine.
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 bg-black/50 p-2 rounded border border-white/5 overflow-x-auto">
                    Command: npx<br/>
                    Args: -y @modelcontextprotocol/server-sqlite
                  </p>
                </div>

                <div className="bg-black/30 p-4 rounded-lg border border-white/5">
                  <h5 className="text-sky-400 font-semibold mb-1 flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4" /> SSE (Remote Server)
                  </h5>
                  <p className="text-xs text-slate-400 mb-2">
                    Connects to a server running somewhere else on the internet using HTTP. This is useful for connecting to massive enterprise databases or external company services.
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 bg-black/50 p-2 rounded border border-white/5 overflow-x-auto">
                    URL: https://api.mycompany.com/mcp-endpoint
                  </p>
                </div>
              </div>
            </div>

            {/* Environment Variables */}
            <div className="bg-[#121222] border border-white/10 rounded-xl p-6 shadow-lg">
              <h3 className="text-white font-bold text-base mb-2">What are Environment Variables?</h3>
              <p className="text-xs text-slate-400 mb-4">
                Some servers need secret keys to work (like a GitHub API Token or a Database Password). You pass these secrets securely using <strong>Environment Variables</strong> in JSON format. Do not worry, these are stored securely in your VS Code Secret Storage.
              </p>
              <pre className="text-[11px] font-mono text-emerald-300 bg-black/50 p-3 rounded-lg border border-white/5 overflow-x-auto">
{`{
  "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_secret_token_here",
  "BRAVE_API_KEY": "your_brave_search_api_key"
}`}
              </pre>
            </div>

            {/* How to Setup */}
            <div className="bg-gradient-to-br from-[#121222] to-emerald-950/20 border border-emerald-500/20 rounded-xl p-6 shadow-lg">
              <h3 className="text-emerald-400 font-bold text-lg mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" /> How to Setup in Chanakya AI
              </h3>
              
              <ol className="list-decimal list-inside space-y-3 text-xs text-slate-300">
                <li>
                  <span className="font-semibold text-white">The Easy Way (1-Click Marketplace):</span> Go to the "1-Click Marketplace" tab above, click on a popular server like SQLite or Brave Search, enter any required keys, and click connect!
                </li>
                <li>
                  <span className="font-semibold text-white">The Manual Way:</span> Click the <span className="bg-emerald-500 text-black px-1.5 py-0.5 rounded font-bold">Add Server</span> button in the top right.
                </li>
                <li className="ml-5">Give your server a name (like <code>my-github</code>).</li>
                <li className="ml-5">Select <strong>Stdio</strong>.</li>
                <li className="ml-5">Set the Command to <code>npx</code>.</li>
                <li className="ml-5">Set the Arguments to <code>-y @modelcontextprotocol/server-github</code>.</li>
                <li className="ml-5">Set the Environment Variables with your tokens (as JSON).</li>
                <li className="ml-5">Click <strong>Connect Server</strong>!</li>
              </ol>

              <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-200 text-xs flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-emerald-400" />
                <p className="leading-relaxed">
                  <strong className="text-emerald-300">Once Setup:</strong> The AI will automatically detect these tools. You can test them manually in the "Tools & Live Runner" tab! 
                  <br/><br/>
                  <strong className="text-white">Crucial Step:</strong> Don't forget to toggle the global MCP button (the chip icon <Cpu className="w-3 h-3 inline-block"/>) in the Chat input box when you want the AI to use these tools in your conversation.
                </p>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Modal: Add Custom MCP Server */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#16162a] border border-white/15 rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" /> Add Custom MCP Server
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Server Name (ID):</label>
                <input
                  type="text"
                  placeholder="e.g. postgres-local, brave-search"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  className="w-full p-2 bg-black/40 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Transport Type:</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewServerType('stdio')}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition ${
                      newServerType === 'stdio'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'border-white/10 text-slate-400'
                    }`}
                  >
                    Stdio (Local Command)
                  </button>
                  <button
                    onClick={() => setNewServerType('sse')}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition ${
                      newServerType === 'sse'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'border-white/10 text-slate-400'
                    }`}
                  >
                    SSE / Remote HTTP
                  </button>
                </div>
              </div>

              {newServerType === 'stdio' ? (
                <>
                  <div>
                    <label className="block text-slate-400 mb-1">Command:</label>
                    <input
                      type="text"
                      placeholder="node, npx, python, etc."
                      value={newServerCommand}
                      onChange={(e) => setNewServerCommand(e.target.value)}
                      className="w-full p-2 bg-black/40 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500/50 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Arguments:</label>
                    <input
                      type="text"
                      placeholder="-y @modelcontextprotocol/server-name"
                      value={newServerArgs}
                      onChange={(e) => setNewServerArgs(e.target.value)}
                      className="w-full p-2 bg-black/40 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500/50 font-mono"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-slate-400 mb-1">Remote Server URL (SSE):</label>
                  <input
                    type="text"
                    placeholder="https://my-mcp-server.com/sse"
                    value={newServerUrl}
                    onChange={(e) => setNewServerUrl(e.target.value)}
                    className="w-full p-2 bg-black/40 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500/50 font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1">Environment Variables (JSON optional):</label>
                <input
                  type="text"
                  placeholder='{"API_KEY": "xxx"}'
                  value={newServerEnv}
                  onChange={(e) => setNewServerEnv(e.target.value)}
                  className="w-full p-2 bg-black/40 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500/50 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomServer}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition"
              >
                Connect Server
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Preset Config Inputs */}
      {selectedPreset && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#16162a] border border-white/15 rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" /> Configure {selectedPreset.name}
            </h2>
            <p className="text-xs text-slate-400">{selectedPreset.description}</p>

            <div className="space-y-3 text-xs">
              {selectedPreset.configFields?.map((field) => (
                <div key={field.key}>
                  <label className="block text-slate-300 font-medium mb-1">{field.label}:</label>
                  <input
                    type={field.type === 'password' ? 'password' : 'text'}
                    placeholder={field.placeholder}
                    value={presetFieldValues[field.key] || ''}
                    onChange={(e) =>
                      setPresetFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="w-full p-2 bg-black/40 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-amber-400 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{field.description}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setSelectedPreset(null)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPresetInstall}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition"
              >
                Connect & Start
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
