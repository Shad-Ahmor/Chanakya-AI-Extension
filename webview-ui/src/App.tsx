import { useEffect, useState, useRef } from 'react';
import { vscode } from './vscode';
import { ChatMessage, ContextItem, ToWebviewMessage, WorkspaceFileResult } from './types/ipc';
import { AppConfig } from './types/config';
import ChatMessageItem from './components/Chat/ChatMessageItem';
import { ActionHubModal } from './components/Chat/ActionHubModal';
import { RulesHubModal } from './components/Chat/RulesHubModal';
import { MentionHubModal } from './components/Chat/MentionHubModal';
import { GoalHubModal } from './components/Chat/GoalHubModal';
import { ArtifactModal } from './components/Chat/ArtifactModal';
import ModelHubView from './components/ModelHub/ModelHubView';
import GraphifyView from './components/Graphify/GraphifyView';
import { TaskPlanHUD, PlanState } from './components/Chat/TaskPlanHUD';
import { AskUserModal } from './components/Chat/AskUserModal';
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
  Target,
  Network
} from 'lucide-react';

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const initialViewMode = (window as any).CHANAKYA_VIEW_MODE === 'dashboard' ? 'dashboard' : 'chat';
  const [viewMode, setViewMode] = useState<'chat' | 'modelhub' | 'dashboard' | 'graphify'>(initialViewMode);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [rawYaml, setRawYaml] = useState<string>('');
  const [initialDashboardTab, setInitialDashboardTab] = useState<'visual' | 'yaml' | 'settings' | 'token_optimizer' | 'analytics'>('visual');
  const [activePlan, setActivePlan] = useState<PlanState | null>(null);
  const [askUserPrompt, setAskUserPrompt] = useState<{ id: string; question: string; options?: string[]; defaultOption?: string; isMultiSelect?: boolean } | null>(null);
  
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
  
  // Action Hub state
  const [showActionHub, setShowActionHub] = useState(false);
  
  // Rules Hub state
  const [showRulesHub, setShowRulesHub] = useState(false);

  // Mention Hub state
  const [showMentionHub, setShowMentionHub] = useState(false);

  // Goal Hub state
  const [showGoalHub, setShowGoalHub] = useState(false);

  // Artifacts State
  const [artifacts, setArtifacts] = useState<Record<string, string>>({});
  const [activeArtifactModal, setActiveArtifactModal] = useState<{name: string, content: string} | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isScrolledToBottomRef = useRef(true);

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

        case 'updateTaskStatus': {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === message.payload.messageId) {
                const currentTasks = msg.taskStatuses || [];
                const taskIndex = currentTasks.findIndex((t) => t.id === message.payload.task.id);
                let newTasks;
                if (taskIndex >= 0) {
                  newTasks = [...currentTasks];
                  newTasks[taskIndex] = message.payload.task;
                } else {
                  newTasks = [...currentTasks, message.payload.task];
                }
                return { ...msg, taskStatuses: newTasks };
              }
              return msg;
            })
          );
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

        case 'streamThoughtChunk': {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === message.payload.messageId
                ? {
                    ...msg,
                    isThinking: true,
                    thought: (msg.thought || '') + message.payload.chunk
                  }
                : msg
            )
          );
          break;
        }

        case 'thoughtComplete': {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === message.payload.messageId
                ? {
                    ...msg,
                    isThinking: false,
                    thought: message.payload.thought,
                    thoughtDurationMs: message.payload.durationMs
                  }
                : msg
            )
          );
          break;
        }

        case 'planUpdated': {
          setActivePlan(message.payload.plan);
          break;
        }

        case 'askUserPrompt': {
          setAskUserPrompt(message.payload);
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

        case 'fileAttached': {
          const { name, path, content } = message.payload;
          setContextItems((prev) => {
            if (prev.some(item => item.path === path)) return prev;
            return [...prev, {
              id: `file-${Date.now()}`,
              type: 'file',
              name: name,
              path: path,
              content: content
            }];
          });
          break;
        }

        case 'artifactUpdated': {
          setArtifacts((prev) => ({
            ...prev,
            [message.payload.name]: message.payload.content
          }));
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              const currentArtifacts = lastMsg.artifacts || [];
              // Only add if not already present
              const existingIdx = currentArtifacts.findIndex(a => a.name === message.payload.name);
              let newArtifacts = [...currentArtifacts];
              if (existingIdx >= 0) {
                newArtifacts[existingIdx] = message.payload;
              } else {
                newArtifacts.push(message.payload);
              }
              const newMsg = { ...lastMsg, artifacts: newArtifacts };
              return [...prev.slice(0, -1), newMsg];
            }
            return prev;
          });
          break;
        }

        case 'fileChanged': {
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              const currentChanges = lastMsg.fileChanges || { count: 0, added: 0, deleted: 0, modified: 0 };
              const type = message.payload.changeType;
              const newChanges = {
                count: currentChanges.count + 1,
                added: currentChanges.added + (type === 'create' ? 1 : 0),
                deleted: currentChanges.deleted + (type === 'delete' ? 1 : 0),
                modified: currentChanges.modified + (type === 'modify' ? 1 : 0),
              };
              return [...prev.slice(0, -1), { ...lastMsg, fileChanges: newChanges }];
            }
            return prev;
          });
          break;
        }

        case 'openGraphifyView': {
          setViewMode('graphify');
          break;
        }
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isScrolledToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      contextItems: itemsToSend,
      timestamp: Date.now()
    };

    isScrolledToBottomRef.current = true;
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
    if (action === 'enhance') prompt = 'You are an elite performance optimization expert. Your task is to deeply analyze this code and enhance it for maximum performance, minimal memory usage, and optimal Big-O time complexity. Implement modern best practices, clean up technical debt, and ensure the code is highly readable. Do not alter the core business logic, but do improve the underlying algorithms and data structures.';
    else if (action === 'refactor') prompt = 'You are a master software architect. Your task is to refactor this code following Clean Architecture and SOLID principles. Break down large monolithic functions into smaller, modular, and reusable components. Improve naming conventions, reduce cyclomatic complexity, and ensure the code is easily testable and maintainable without changing its external behavior.';
    else if (action === 'bugs') prompt = 'You are a senior security researcher and QA engineer. Review this code methodically line-by-line to identify hidden bugs, edge cases, race conditions, memory leaks, and potential security vulnerabilities (e.g., injection flaws, unhandled exceptions). Highlight every issue you find, explain the root cause, and provide a robust code fix to patch it.';
    else if (action === 'docstrings') prompt = 'Act as a strict documentation standardizer. Add comprehensive, professional-grade docstrings and type annotations to all functions, classes, and complex logic blocks in this code. Include detailed descriptions, `@param` and `@returns` definitions, and explain the "why" behind non-obvious logic. The documentation must be ready for auto-generation tools.';
    else if (action === 'tests') prompt = 'You are an expert Test-Driven Development (TDD) engineer. Write a comprehensive suite of unit tests for this code using a modern testing framework. Cover all happy paths, boundary conditions, edge cases, and error-handling scenarios. Mock external dependencies where necessary and ensure high code coverage.';
    else if (action === 'architecture') prompt = 'You are a Master Software Architect. Your task is to deeply analyze the entire open project. You must autonomously open every single file and folder—DO NOT miss or skip a single file, no matter how small or deeply nested. Carefully read and understand their purpose, the language used, how they connect with other components, and their overall workflow. As you process each file, you MUST continuously and live-update a detailed `architecture.md` file that maps out this structure. Use the local offline memory and workspace tools to understand the project deeply according to your plan. Note: THERE ARE NO TOKEN LIMITS for this task. Take as much time and context as you need to build a 100% complete and exhaustive architecture plan. Creating this architecture plan is strictly necessary so that the AI agent and MCP server can fully comprehend everything happening in the project.';
    else if (action === 'explain') prompt = 'Act as an expert technical mentor. Break down this code step-by-step and explain exactly how it works. Discuss the data flow, the architectural decisions, and the purpose of each major block. Use clear analogies if the logic is complex, and outline any dependencies or side-effects the code might have.';
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

  if (viewMode === 'graphify') {
    return <GraphifyView onBack={() => setViewMode('chat')} />;
  }

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
            onClick={() => setViewMode('graphify')}
            title="Open Graphify Architecture Visualizer"
            className="p-1.5 hover:bg-rose-500/20 rounded-lg transition text-rose-400/80 hover:text-rose-400 border border-transparent hover:border-rose-500/30"
          >
            <Network className="w-3.5 h-3.5" />
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
        <button
          onClick={() => handleQuickAction('architecture')}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 whitespace-nowrap transition"
        >
          <Network className="w-3 h-3 text-rose-400" />
          <span>Architecture</span>
        </button>
      </div>

      {/* Artifacts Top Bar */}
      {Object.keys(artifacts).length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-black/30 overflow-x-auto">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Artifacts</span>
          <div className="flex gap-2">
            {Object.entries(artifacts).map(([name, content]) => (
              <button
                key={name}
                onClick={() => setActiveArtifactModal({ name, content })}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border border-sky-500/20 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 transition shadow-sm"
              >
                <FileText className="w-3 h-3 text-sky-400" />
                <span>{name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* DeepSeek Plan / Task Checklist HUD */}
      <TaskPlanHUD plan={activePlan} onDismiss={() => setActivePlan(null)} />

      {/* Messages List */}
      <main 
        className="flex-1 overflow-y-auto p-3.5 space-y-4"
        onScroll={(e) => {
          const target = e.target as HTMLElement;
          const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 30;
          isScrolledToBottomRef.current = isAtBottom;
        }}
      >
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
          messages.map((msg) => (
            <ChatMessageItem 
              key={msg.id} 
              message={msg}
              onOpenArtifact={(name, content) => setActiveArtifactModal({ name, content })}
            />
          ))
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
                  <div className="text-[9px] text-white/40">Inline edit instructions</div>
                </div>
              </button>
            )}

            {(!slashQuery || 'plan'.includes(slashQuery)) && (
              <button
                onClick={() => {
                  setShowSlashMenu(false);
                  setInput('Formulate a structured step-by-step implementation plan for the current task using todo_write and execute it sequentially.');
                }}
                className="w-full text-left px-3 py-2 hover:bg-blue-500/20 hover:text-blue-200 flex items-center gap-2 border-b border-white/5 transition"
              >
                <div className="p-1 rounded bg-blue-500/20">
                  <Target className="w-3 h-3 text-blue-400" />
                </div>
                <div>
                  <div className="font-bold text-[11px] text-blue-300">/plan</div>
                  <div className="text-[9px] text-white/40">DeepSeek Multi-step Task DAG Plan</div>
                </div>
              </button>
            )}

            {(!slashQuery || 'arch'.includes(slashQuery)) && (
              <button
                onClick={() => {
                  setShowSlashMenu(false);
                  setViewMode('graphify');
                }}
                className="w-full text-left px-3 py-2 hover:bg-cyan-500/20 hover:text-cyan-200 flex items-center gap-2 border-b border-white/5 transition"
              >
                <div className="p-1 rounded bg-cyan-500/20">
                  <Network className="w-3 h-3 text-cyan-400" />
                </div>
                <div>
                  <div className="font-bold text-[11px] text-cyan-300">/arch</div>
                  <div className="text-[9px] text-white/40">Open Graphify Architecture Map</div>
                </div>
              </button>
            )}

            {(!slashQuery || 'lsp'.includes(slashQuery)) && (
              <button
                onClick={() => {
                  setShowSlashMenu(false);
                  setInput('Use LSP semantic tools (lsp_goto_definition, lsp_find_references, lsp_hover) to analyze the active symbol.');
                }}
                className="w-full text-left px-3 py-2 hover:bg-emerald-500/20 hover:text-emerald-200 flex items-center gap-2 transition"
              >
                <div className="p-1 rounded bg-emerald-500/20">
                  <Code className="w-3 h-3 text-emerald-400" />
                </div>
                <div>
                  <div className="font-bold text-[11px] text-emerald-300">/lsp</div>
                  <div className="text-[9px] text-white/40">Query Language Server Protocol</div>
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
                onClick={() => vscode.postMessage({ type: 'openFilePicker' })}
                className="p-1.5 hover:bg-vscode-list-hoverBackground rounded-lg transition text-vscode-descriptionForeground hover:text-vscode-foreground"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                title="Mention Context"
                onClick={() => setShowMentionHub(true)}
                className="p-1.5 hover:bg-vscode-list-hoverBackground rounded-lg transition text-vscode-descriptionForeground hover:text-vscode-foreground"
              >
                <AtSign className="w-4 h-4" />
              </button>
              <button
                title="Rules Hub"
                onClick={() => setShowRulesHub(true)}
                className="p-1.5 hover:bg-vscode-list-hoverBackground rounded-lg transition text-vscode-descriptionForeground hover:text-vscode-foreground"
              >
                <ScrollText className="w-4 h-4" />
              </button>
              <button
                title="Action Hub"
                onClick={() => setShowActionHub(true)}
                className="p-1.5 hover:bg-vscode-list-hoverBackground rounded-lg transition text-vscode-descriptionForeground hover:text-vscode-foreground"
              >
                <Zap className="w-4 h-4" />
              </button>
              <button
                title="Goal Hub"
                onClick={() => setShowGoalHub(true)}
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

      {showActionHub && (
        <ActionHubModal 
          onClose={() => setShowActionHub(false)}
          onSelectAction={(prompt) => {
            setInput((prev) => prev + (prev.length > 0 && !prev.endsWith(' ') ? ' ' : '') + prompt);
            setShowActionHub(false);
            if (textareaRef.current) {
              textareaRef.current.focus();
            }
          }}
        />
      )}

      {showRulesHub && (
        <RulesHubModal 
          onClose={() => setShowRulesHub(false)}
          onSelectRule={(rulePrompt) => {
            setInput((prev) => prev + (prev.length > 0 && !prev.endsWith(' ') ? '\n\n' : '') + rulePrompt);
            setShowRulesHub(false);
            if (textareaRef.current) {
              textareaRef.current.focus();
            }
          }}
        />
      )}

      {showMentionHub && (
        <MentionHubModal 
          onClose={() => setShowMentionHub(false)}
          onSelectMention={(prompt) => {
            setShowMentionHub(false);
            if (prompt === 'FILE_PICKER') {
              vscode.postMessage({ type: 'openFilePicker' });
            } else {
              setInput((prev) => prev + (prev.length > 0 && !prev.endsWith(' ') ? ' ' : '') + prompt);
              if (textareaRef.current) {
                textareaRef.current.focus();
              }
            }
          }}
        />
      )}

      {showGoalHub && (
        <GoalHubModal 
          onClose={() => setShowGoalHub(false)}
          onSelectGoal={(prompt) => {
            setInput((prev) => prev + (prev.length > 0 && !prev.endsWith(' ') ? '\n\n' : '') + prompt);
            setShowGoalHub(false);
            if (textareaRef.current) {
              textareaRef.current.focus();
            }
          }}
        />
      )}

      {activeArtifactModal && (
        <ArtifactModal
          name={activeArtifactModal.name}
          content={activeArtifactModal.content}
          onClose={() => setActiveArtifactModal(null)}
          onProceed={() => {
            setActiveArtifactModal(null);
            vscode.postMessage({ type: 'submitProceed' });
          }}
        />
      )}
      {/* Interactive Ask-User Modal */}
      {askUserPrompt && (
        <AskUserModal
          {...askUserPrompt}
          onClose={() => setAskUserPrompt(null)}
        />
      )}
    </div>
  );
}
