import { useEffect, useState, useRef } from 'react';
import { vscode } from './vscode';
import { ChatMessage, ContextItem, ToWebviewMessage, WorkspaceFileResult } from './types/ipc';
import { AppConfig } from './types/config';
import ChatMessageItem from './components/Chat/ChatMessageItem';
import ModelHubView from './components/ModelHub/ModelHubView';
import {
  Sparkles,
  Send,
  Settings,
  Code,
  FileText,
  X,
  ChevronDown,
  Square,
  Plus,
  History,
  MessageSquare,
  Cpu,
  Globe,
  Server,
  Zap,
  Bug,
  BookOpen,
  TestTube,
  Paperclip,
  AtSign,
  ScrollText,
  Target
} from 'lucide-react';

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [promptQueue, setPromptQueue] = useState<{text: string, contextItems: ContextItem[]}[]>([]);
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const initialViewMode = (window as any).CHANAKYA_VIEW_MODE === 'dashboard' ? 'dashboard' : 'chat';
  const [viewMode, setViewMode] = useState<'chat' | 'modelhub' | 'dashboard'>(initialViewMode);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [rawYaml, setRawYaml] = useState<string>('');
  const [initialDashboardTab, setInitialDashboardTab] = useState<'visual' | 'yaml' | 'settings' | 'token_optimizer' | 'analytics'>('visual');
  
  // Conversation History State
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  
  // @ mentions autocomplete state
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionFiles, setMentionFiles] = useState<WorkspaceFileResult[]>([]);

  // slash command state
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');
  const shortcutModifier = isMac ? 'Cmd' : 'Ctrl';

  useEffect(() => {
    // Notify extension host that UI is ready
    vscode.postMessage({ type: 'ready' });
    vscode.postMessage({ type: 'getConfig' });

    // Listen to messages from extension host
    const unsubscribe = vscode.onMessage((message: ToWebviewMessage) => {
      switch (message.type) {
        case 'configResult': {
          setConfig(message.payload.config);
          setRawYaml(message.payload.rawYaml);
          break;
        }

        case 'openSettingsTab': {
          setViewMode('dashboard');
          setInitialDashboardTab('settings');
          break;
        }

        case 'addMessage': {
          setMessages((prev) => [...prev, message.payload]);
          break;
        }

        case 'streamChunk': {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === message.payload.messageId
                ? { ...msg, content: msg.content + message.payload.chunk }
                : msg
            )
          );
          break;
        }

        case 'streamEnd': {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === message.payload.messageId ? { ...msg, isStreaming: false } : msg
            )
          );
          setIsLoading(false);
          break;
        }

        case 'addContextItem': {
          setContextItems((prev) => {
            if (prev.some((item) => item.id === message.payload.id)) return prev;
            return [...prev, message.payload];
          });
          break;
        }

        case 'workspaceFilesResult': {
          setMentionFiles(message.payload.files);
          break;
        }

        case 'fileContentResult': {
          setContextItems((prev) => {
            if (prev.some((item) => item.id === message.payload.contextItem.id)) return prev;
            return [...prev, message.payload.contextItem];
          });
          break;
        }

        case 'optimizationStats': {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === message.payload.messageId
                ? {
                    ...msg,
                    optimizationStats: {
                      originalTokens: message.payload.originalTokens,
                      optimizedTokens: message.payload.optimizedTokens
                    }
                  }
                : msg
            )
          );
          break;
        }

        case 'setLoading': {
          setIsLoading(message.payload.isLoading);
          break;
        }

        case 'clearChat': {
          setMessages([]);
          setContextItems([]);
          break;
        }

        case 'conversationsLoaded': {
          setConversations(message.payload.conversations);
          if (message.payload.activeId) {
            setActiveConversationId(message.payload.activeId);
            const active = message.payload.conversations.find((c: any) => c.id === message.payload.activeId);
            if (active) {
              setMessages(active.messages);
            }
          } else {
            setActiveConversationId(null);
            setMessages([]);
          }
          break;
        }

        case 'activeConversationChanged': {
          const conv = message.payload.conversation;
          setActiveConversationId(conv.id);
          setMessages(conv.messages);
          // Also update the conv list if needed, or wait for conversationsLoaded
          setConversations((prev) => {
            const exists = prev.find(c => c.id === conv.id);
            if (exists) {
              return prev.map(c => c.id === conv.id ? conv : c).sort((a, b) => b.updatedAt - a.updatedAt);
            } else {
              return [conv, ...prev].sort((a, b) => b.updatedAt - a.updatedAt);
            }
          });
          break;
        }
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Queue Execution Effect
  useEffect(() => {
    if (!isLoading && promptQueue.length > 0) {
      const nextTask = promptQueue[0];
      setPromptQueue(prev => prev.slice(1));
      handleSendPrompt(nextTask.text, nextTask.contextItems);
    }
  }, [isLoading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 130)}px`;

    // Check for @ mention or / command trigger
    const cursorIndex = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorIndex);
    const lastAtMatch = textBeforeCursor.match(/(?:^|\s)@([\w.-]*)$/);
    const lastSlashMatch = textBeforeCursor.match(/(?:^|\s)\/([a-z]*)$/);

    if (lastAtMatch) {
      const q = lastAtMatch[1] || '';
      setMentionQuery(q.toLowerCase());
      setShowMentionMenu(true);
      setShowSlashMenu(false);
      
      // If typing specifically for terminal/codebase, don't spam file search yet
      if (q && !'terminal'.includes(q.toLowerCase()) && !'codebase'.includes(q.toLowerCase())) {
        vscode.postMessage({
          type: 'searchWorkspaceFiles',
          payload: { query: q }
        });
      }
    } else if (lastSlashMatch) {
      const q = lastSlashMatch[1] || '';
      setSlashQuery(q.toLowerCase());
      setShowSlashMenu(true);
      setShowMentionMenu(false);
    } else {
      setShowMentionMenu(false);
      setShowSlashMenu(false);
    }
  };

  const handleSelectMentionFile = (file: WorkspaceFileResult) => {
    setShowMentionMenu(false);
    const cursorIndex = textareaRef.current?.selectionStart || input.length;
    const textBefore = input.slice(0, cursorIndex).replace(/@([\w.-]*)$/, '');
    const textAfter = input.slice(cursorIndex);
    setInput(textBefore + textAfter);

    vscode.postMessage({
      type: 'readFileContent',
      payload: { path: file.path }
    });
  };

  const handleSendPrompt = (promptText?: string, overrideContextItems?: ContextItem[]) => {
    const textToSend = promptText || input;
    const itemsToSend = overrideContextItems || [...contextItems];
    
    if (!textToSend.trim() && itemsToSend.length === 0) return;

    if (isLoading) {
      setPromptQueue(prev => [...prev, { text: textToSend, contextItems: itemsToSend }]);
      setInput('');
      setContextItems([]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      contextItems: itemsToSend,
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    vscode.postMessage({
      type: 'sendMessage',
      payload: {
        text: textToSend,
        contextItems: itemsToSend
      }
    });

    setInput('');
    setContextItems([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleQuickAction = (action: string) => {
    let prompt = '';
    if (action === 'enhance') prompt = 'Enhance and optimize this code for maximum performance and readability.';
    else if (action === 'refactor') prompt = 'Refactor this code following clean code architecture and SOLID principles.';
    else if (action === 'bugs') prompt = 'Review this code carefully and identify any bugs, edge cases, or potential security vulnerabilities.';
    else if (action === 'docstrings') prompt = 'Add complete JSDoc / docstrings and type annotations to this code.';
    else if (action === 'tests') prompt = 'Write comprehensive unit test cases for this code covering happy paths and edge cases.';
    else if (action === 'explain') prompt = 'Explain this code in detail, breaking down what it does step by step.';
    else if (action === 'edit') prompt = 'I want you to edit this code. Reply ONLY with the complete modified code, do not use markdown blocks, just raw code.';

    handleSendPrompt(prompt);
  };

  const handleAbort = () => {
    vscode.postMessage({ type: 'abortGeneration' });
    setIsLoading(false);
  };

  const handleUpdateConfig = (newConfig: AppConfig, newYaml?: string) => {
    setConfig(newConfig);
    if (newYaml) setRawYaml(newYaml);
    vscode.postMessage({
      type: 'saveConfig',
      payload: { config: newConfig, rawYaml: newYaml }
    });
  };

  const activeModel =
    config?.models.find((m) => m.id === config.activeChatModelId || m.name === config.activeChatModelId) ||
    config?.models[0];

  const isEnterprise = activeModel?.requestOptions?.headers && Object.keys(activeModel.requestOptions.headers).length > 0;

  const handleToolbarInsert = (action: 'mention' | 'slash', cmd?: string) => {
    let newVal = input;
    if (action === 'mention') {
      newVal = input + (input.endsWith(' ') || input === '' ? '@' : ' @');
      setInput(newVal);
      setMentionQuery('');
      setShowMentionMenu(true);
      setShowSlashMenu(false);
    } else if (action === 'slash' && cmd) {
      newVal = input + (input.endsWith(' ') || input === '' ? `/${cmd} ` : ` /${cmd} `);
      setInput(newVal);
      setShowSlashMenu(false);
      setShowMentionMenu(false);
    }
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newVal.length, newVal.length);
      }
    }, 0);
  };

  if ((viewMode === 'modelhub' || viewMode === 'dashboard') && config) {
    return (
      <ModelHubView
        config={config}
        rawYaml={rawYaml}
        onUpdateConfig={handleUpdateConfig}
        onClose={() => setViewMode('chat')}
        isDashboard={viewMode === 'dashboard'}
        initialDashboardTab={initialDashboardTab}
      />
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-vscode-editor-background text-vscode-fg text-[13px] overflow-hidden">
      {/* Top Header */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/40 backdrop-blur-md select-none z-10 shadow-sm">
        {/* Model Selector Dropdown */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="relative flex items-center bg-white/[0.04] border border-white/10 hover:border-sky-400/50 hover:bg-white/[0.08] rounded-lg transition px-2.5 py-1 w-full max-w-[200px] shadow-sm group">
            {activeModel?.isLocal ? (
              <Cpu className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            ) : isEnterprise ? (
              <Server className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
            ) : (
              <Globe className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            )}
            <select
              value={activeModel?.id || activeModel?.name || ''}
              onChange={(e) => {
                const newModelId = e.target.value;
                if (!config) return;
                const updatedConfig = { ...config, activeChatModelId: newModelId };
                handleUpdateConfig(updatedConfig);
              }}
              className="appearance-none bg-transparent outline-none font-bold text-[11px] text-white group-hover:text-sky-300 transition w-full pl-2 pr-5 cursor-pointer truncate"
              title="Switch Active Chat Model"
            >
              {config?.models.map((m) => (
                <option key={m.id || m.name} value={m.id || m.name} className="bg-[var(--vscode-editor-background)] text-[var(--vscode-foreground)]">
                  {m.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-white/40 group-hover:text-white flex-shrink-0 absolute right-1.5 pointer-events-none" />
          </div>
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => vscode.postMessage({ type: 'newConversation' })}
            title="New Chat"
            className="p-1.5 hover:bg-emerald-500/20 rounded-lg transition text-emerald-400/80 hover:text-emerald-400 border border-transparent hover:border-emerald-500/30"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsHistoryDrawerOpen(!isHistoryDrawerOpen)}
            title="Chat History"
            className={`p-1.5 rounded-lg transition border ${isHistoryDrawerOpen ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'hover:bg-purple-500/20 text-purple-400/80 hover:text-purple-400 border-transparent hover:border-purple-500/30'}`}
          >
            <History className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('dashboard')}
            title="Open AI Dashboard & Model Hub"
            className="p-1.5 hover:bg-sky-500/20 rounded-lg transition text-sky-400/80 hover:text-sky-400 border border-transparent hover:border-sky-500/30"
          >
            <Zap className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => vscode.postMessage({ type: 'openSettings' })}
            title="Open Extension Settings"
            className="p-1.5 hover:bg-white/10 rounded-lg transition text-white/60 hover:text-white"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* History Drawer Overlay */}
      {isHistoryDrawerOpen && (
        <div className="absolute top-[48px] bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col">
          <div className="flex-1 bg-[#1e1e1e] border-t border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between bg-black/20">
              <span className="text-xs font-bold text-white/70 flex items-center gap-1.5"><History className="w-3 h-3"/> Chat History</span>
              <button onClick={() => setIsHistoryDrawerOpen(false)} className="p-1 hover:bg-white/10 rounded-md text-white/50 hover:text-white transition">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {conversations.length === 0 ? (
                <div className="text-center p-4 text-white/40 text-xs">No previous chats found.</div>
              ) : (
                conversations.map(conv => (
                  <div
                    key={conv.id}
                    onClick={() => {
                      vscode.postMessage({ type: 'loadConversation', payload: { id: conv.id } });
                      setIsHistoryDrawerOpen(false);
                    }}
                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition ${activeConversationId === conv.id ? 'bg-sky-500/20 border border-sky-500/30 text-sky-100' : 'hover:bg-white/5 border border-transparent text-white/70'}`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                      <span className="truncate text-xs">{conv.title}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        vscode.postMessage({ type: 'deleteConversation', payload: { id: conv.id } });
                      }}
                      className="opacity-0 hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded text-white/40 transition group-hover:opacity-50"
                      title="Delete Chat"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/5 bg-black/20 overflow-x-auto select-none">
        <button
          onClick={() => handleQuickAction('enhance')}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 whitespace-nowrap transition"
        >
          <Sparkles className="w-3 h-3 text-sky-400" />
          <span>Enhance</span>
        </button>
        <button
          onClick={() => handleQuickAction('refactor')}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 whitespace-nowrap transition"
        >
          <Zap className="w-3 h-3 text-purple-400" />
          <span>Refactor</span>
        </button>
        <button
          onClick={() => handleQuickAction('bugs')}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 whitespace-nowrap transition"
        >
          <Bug className="w-3 h-3 text-amber-400" />
          <span>Find Bugs</span>
        </button>
        <button
          onClick={() => handleQuickAction('docstrings')}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 whitespace-nowrap transition"
        >
          <BookOpen className="w-3 h-3 text-emerald-400" />
          <span>Docstrings</span>
        </button>
        <button
          onClick={() => handleQuickAction('tests')}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 whitespace-nowrap transition"
        >
          <TestTube className="w-3 h-3 text-blue-400" />
          <span>Unit Tests</span>
        </button>
      </div>

      {/* Messages List */}
      <main className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-vscode-fg/60 select-none">
            <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-sky-500/20 to-purple-500/20 border border-sky-400/30 flex items-center justify-center mb-3 shadow-xl animate-glow">
              <Sparkles className="w-7 h-7 text-sky-400" />
            </div>
            <h3 className="font-extrabold text-white text-base mb-1 tracking-tight">Chanakya AI Enhancer</h3>
            <p className="text-xs max-w-xs mb-4 text-white/70 leading-relaxed">
              Connected to <strong className="text-sky-300 font-mono">{activeModel?.name}</strong>.
            </p>

            <div className="glass-card rounded-xl p-3 text-left text-xs space-y-1.5 max-w-xs text-white/80 border border-white/10 shadow-lg">
              <div className="flex items-center gap-1.5">
                <span>💡</span>
                <span>Highlight code & press <kbd className="px-1.5 py-0.5 bg-black/40 border border-white/15 rounded font-mono text-[10px] text-sky-300 font-bold">{shortcutModifier}+Alt+L</kbd></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>📂</span>
                <span>Type <strong className="text-sky-400 font-mono font-bold">@</strong> to attach files from workspace</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>🎛️</span>
                <span>Click <strong className="text-purple-300 font-bold">Hub</strong> to switch Local / Enterprise models</span>
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => <ChatMessageItem key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Section */}
      <footer className="p-3 border-t border-white/10 bg-black/40 backdrop-blur-md flex flex-col gap-2 relative">
        {/* @ Mention Autocomplete Menu */}
        {showMentionMenu && (
          <div className="absolute bottom-full left-3 right-3 mb-1.5 bg-zinc-900 border border-white/15 rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50 text-xs backdrop-blur-xl">
            <div className="px-3 py-1.5 bg-white/[0.04] text-[11px] font-bold text-sky-300 uppercase tracking-wider border-b border-white/10 flex justify-between items-center">
              <span>Context Providers matching "@{mentionQuery}"</span>
              <button onClick={() => setShowMentionMenu(false)} className="hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {/* Show Codebase Provider if it matches the query */}
            {(!mentionQuery || 'codebase'.includes(mentionQuery)) && (
              <button
                onClick={() => {
                  setShowMentionMenu(false);
                  const cursorIndex = textareaRef.current?.selectionStart || input.length;
                  const textBefore = input.slice(0, cursorIndex).replace(/(?:^|\s)@([\w.-]*)$/, ' ');
                  const textAfter = input.slice(cursorIndex);
                  setInput((textBefore + textAfter).trimStart());
                  setContextItems(prev => [...prev, {
                    id: `codebase-${Date.now()}`,
                    type: 'codebase',
                    name: 'Codebase',
                    content: ''
                  }]);
                }}
                className="w-full text-left px-3 py-2 hover:bg-purple-500/20 hover:text-purple-200 flex items-center gap-2 border-b border-white/5 transition"
              >
                <div className="p-1 rounded bg-purple-500/20">
                  <BookOpen className="w-3 h-3 text-purple-400" />
                </div>
                <div>
                  <div className="font-bold text-[11px] text-purple-300">Codebase</div>
                  <div className="text-[9px] text-white/40">Search entire workspace</div>
                </div>
              </button>
            )}

            {/* Show Terminal Provider if it matches the query */}
            {(!mentionQuery || 'terminal'.includes(mentionQuery)) && (
              <button
                onClick={() => {
                  setShowMentionMenu(false);
                  const cursorIndex = textareaRef.current?.selectionStart || input.length;
                  const textBefore = input.slice(0, cursorIndex).replace(/(?:^|\s)@([\w.-]*)$/, ' ');
                  const textAfter = input.slice(cursorIndex);
                  setInput((textBefore + textAfter).trimStart());
                  vscode.postMessage({ type: 'readTerminalContent' });
                }}
                className="w-full text-left px-3 py-2 hover:bg-emerald-500/20 hover:text-emerald-200 flex items-center gap-2 border-b border-white/5 transition"
              >
                <div className="p-1 rounded bg-emerald-500/20">
                  <Square className="w-3 h-3 text-emerald-400" />
                </div>
                <div>
                  <div className="font-bold text-[11px] text-emerald-300">Terminal</div>
                  <div className="text-[9px] text-white/40">Read recent terminal output</div>
                </div>
              </button>
            )}

            {/* Files Context */}
            {mentionFiles.map((file) => (
              <button
                key={file.path}
                onClick={() => handleSelectMentionFile(file)}
                className="w-full text-left px-3 py-2 hover:bg-sky-500/20 hover:text-sky-200 flex items-center gap-2 border-b border-white/5 last:border-0 transition"
              >
                <FileText className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span className="truncate font-mono text-[11px]">{file.label}</span>
              </button>
            ))}
            
            {(!mentionQuery || 'terminal'.includes(mentionQuery) || 'codebase'.includes(mentionQuery)) === false && mentionFiles.length === 0 && (
              <div className="p-3 text-center text-white/40 italic">No matching providers or files found</div>
            )}
          </div>
        )}

        {/* / Slash Command Menu */}
        {showSlashMenu && (
          <div className="absolute bottom-full left-3 right-3 mb-1.5 bg-zinc-900 border border-white/15 rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50 text-xs backdrop-blur-xl">
            <div className="px-3 py-1.5 bg-white/[0.04] text-[11px] font-bold text-sky-300 uppercase tracking-wider border-b border-white/10 flex justify-between items-center">
              <span>Commands matching "/{slashQuery}"</span>
              <button onClick={() => setShowSlashMenu(false)} className="hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {(!slashQuery || 'commit'.includes(slashQuery)) && (
              <button
                onClick={() => {
                  setShowSlashMenu(false);
                  setInput('');
                  vscode.postMessage({ type: 'generateCommitMessage' });
                }}
                className="w-full text-left px-3 py-2 hover:bg-amber-500/20 hover:text-amber-200 flex items-center gap-2 border-b border-white/5 transition"
              >
                <div className="p-1 rounded bg-amber-500/20">
                  <Code className="w-3 h-3 text-amber-400" />
                </div>
                <div>
                  <div className="font-bold text-[11px] text-amber-300">/commit</div>
                  <div className="text-[9px] text-white/40">Generate a git commit message</div>
                </div>
              </button>
            )}

            {(!slashQuery || 'explain'.includes(slashQuery)) && (
              <button
                onClick={() => {
                  setShowSlashMenu(false);
                  setInput('');
                  handleQuickAction('explain');
                }}
                className="w-full text-left px-3 py-2 hover:bg-sky-500/20 hover:text-sky-200 flex items-center gap-2 border-b border-white/5 transition"
              >
                <div className="p-1 rounded bg-sky-500/20">
                  <BookOpen className="w-3 h-3 text-sky-400" />
                </div>
                <div>
                  <div className="font-bold text-[11px] text-sky-300">/explain</div>
                  <div className="text-[9px] text-white/40">Explain the selected code</div>
                </div>
              </button>
            )}

            {(!slashQuery || 'edit'.includes(slashQuery)) && (
              <button
                onClick={() => {
                  setShowSlashMenu(false);
                  setInput('');
                  handleQuickAction('edit');
                }}
                className="w-full text-left px-3 py-2 hover:bg-purple-500/20 hover:text-purple-200 flex items-center gap-2 border-b border-white/5 transition"
              >
                <div className="p-1 rounded bg-purple-500/20">
                  <Zap className="w-3 h-3 text-purple-400" />
                </div>
                <div>
                  <div className="font-bold text-[11px] text-purple-300">/edit</div>
                  <div className="text-[9px] text-white/40">Edit selected code (same as Cmd+I)</div>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Context Pills Area */}
        {contextItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto py-1 select-none">
            {contextItems.map((item) => (
              <span
                key={item.id}
                className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full border font-mono shadow-sm ${
                  item.type === 'terminal' 
                    ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300' 
                  : item.type === 'codebase'
                    ? 'bg-purple-500/15 border-purple-400/30 text-purple-300'
                    : 'bg-sky-500/15 border-sky-400/30 text-sky-300'
                }`}
              >
                {item.type === 'file' ? (
                  <FileText className="w-3 h-3 text-sky-400" />
                ) : item.type === 'terminal' ? (
                  <Square className="w-3 h-3 text-emerald-400" />
                ) : item.type === 'codebase' ? (
                  <BookOpen className="w-3 h-3 text-purple-400" />
                ) : (
                  <Code className="w-3 h-3 text-purple-400" />
                )}
                <span className="truncate max-w-[150px]">{item.name}</span>
                <button
                  onClick={() => setContextItems((prev) => prev.filter((i) => i.id !== item.id))}
                  className="hover:text-red-400 transition ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}


        {/* Chat Input Container */}
        <div className="flex flex-col gap-2 relative">
          {promptQueue.length > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs font-semibold text-yellow-500 shadow-sm animate-pulse">
              <span>{promptQueue.length} Task(s) Pending in Queue...</span>
              <button onClick={() => setPromptQueue([])} className="hover:text-yellow-400 underline" title="Clear Queue">
                Clear
              </button>
            </div>
          )}
          
          <div className="relative bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded-xl shadow-sm focus-within:border-[var(--vscode-focusBorder)] focus-within:ring-1 focus-within:ring-[var(--vscode-focusBorder)] transition-all flex flex-col p-2 z-10">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !showMentionMenu) {
                  e.preventDefault();
                  handleSendPrompt();
                }
              }}
              placeholder="Ask Chanakya AI Enhancer or type @ to attach files..."
            rows={1}
            className="w-full bg-transparent text-vscode-input-foreground outline-none resize-none text-[13px] leading-snug max-h-32 placeholder-vscode-input-placeholder p-1"
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-0.5">
              <button
                title="Attach File"
                onClick={() => handleToolbarInsert('mention')}
                className="p-1.5 hover:bg-vscode-list-hoverBackground rounded-lg transition text-vscode-descriptionForeground hover:text-vscode-foreground"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                title="Mention Context"
                onClick={() => handleToolbarInsert('mention')}
                className="p-1.5 hover:bg-vscode-list-hoverBackground rounded-lg transition text-vscode-descriptionForeground hover:text-vscode-foreground"
              >
                <AtSign className="w-4 h-4" />
              </button>
              <button
                title="Rules"
                onClick={() => handleToolbarInsert('slash', 'rules')}
                className="p-1.5 hover:bg-vscode-list-hoverBackground rounded-lg transition text-vscode-descriptionForeground hover:text-vscode-foreground"
              >
                <ScrollText className="w-4 h-4" />
              </button>
              <button
                title="Action"
                onClick={() => handleToolbarInsert('slash', 'action')}
                className="p-1.5 hover:bg-vscode-list-hoverBackground rounded-lg transition text-vscode-descriptionForeground hover:text-vscode-foreground"
              >
                <Zap className="w-4 h-4" />
              </button>
              <button
                title="Goal"
                onClick={() => handleToolbarInsert('slash', 'goal')}
                className="p-1.5 hover:bg-vscode-list-hoverBackground rounded-lg transition text-vscode-descriptionForeground hover:text-vscode-foreground"
              >
                <Target className="w-4 h-4" />
              </button>
            </div>

            {isLoading ? (
              <div className="flex gap-2">
                <button
                  onClick={() => handleSendPrompt()}
                  disabled={!input.trim() && contextItems.length === 0}
                  title="Queue Message (Enter)"
                  className="p-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500 border border-yellow-500/30 rounded-lg transition flex items-center justify-center shadow-md whitespace-nowrap text-[10px] font-bold"
                >
                  QUEUE
                </button>
                <button
                  onClick={handleAbort}
                  title="Stop Generation"
                  className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition flex items-center justify-center shadow-md"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleSendPrompt()}
                disabled={!input.trim() && contextItems.length === 0}
                title="Send Message (Enter)"
                className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white disabled:opacity-40 rounded-lg transition flex items-center justify-center shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
      </footer>
    </div>
  );
}
