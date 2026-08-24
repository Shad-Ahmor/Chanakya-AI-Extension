import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '../../types/ipc';
import CodeBlock from './CodeBlock';
import { Code, FileText, Bot, User, Sparkles, Undo2, ArrowDownRight, Loader2, ChevronRight, Copy, Check, ThumbsUp, ThumbsDown, GitBranch } from 'lucide-react';
import { vscode } from '../../vscode';
import { useState, useEffect } from 'react';

function DynamicTimer() {
  const [elapsed, setElapsed] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  return <span>{elapsed}s</span>;
}
interface Props {
  message: ChatMessage;
  onOpenArtifact?: (name: string, content: string) => void;
}

export default function ChatMessageItem({ message, onOpenArtifact }: Props) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [answeredTools, setAnsweredTools] = useState<Record<string, string>>({});
  const [showThought, setShowThought] = useState(false);

  const handleCopyMessage = () => {
    vscode.postMessage({
      type: 'copyToClipboard',
      payload: { text: message.content }
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const parseContentWithToolCalls = (content: string) => {
    const blocks: { type: 'text' | 'tool'; content: string; parsed?: any }[] = [];
    const regex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        blocks.push({ type: 'text', content: content.substring(lastIndex, match.index) });
      }
      
      let parsedData = null;
      try {
        let jsonString = match[1].trim();
        jsonString = jsonString.replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '');
        parsedData = JSON.parse(jsonString);
      } catch (e) {
        // invalid JSON yet
      }
      
      blocks.push({ type: 'tool', content: match[1], parsed: parsedData });
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < content.length) {
      const remaining = content.substring(lastIndex);
      const openTagMatch = remaining.match(/<tool_call>([\s\S]*)$/);
      if (openTagMatch) {
        const textBefore = remaining.substring(0, openTagMatch.index);
        if (textBefore) blocks.push({ type: 'text', content: textBefore });
        blocks.push({ type: 'tool', content: openTagMatch[1], parsed: null });
      } else {
        blocks.push({ type: 'text', content: remaining });
      }
    }
    
    return blocks;
  };

  const blocks = isUser ? [] : parseContentWithToolCalls(message.content);

  return (
    <div
      className={`flex flex-col p-4 rounded-2xl transition-all leading-relaxed relative overflow-hidden ${
        isUser
          ? 'bg-vscode-widgetBg text-vscode-editorFg ml-6 shadow-md border border-vscode-widgetBorder'
          : 'bg-vscode-editor-background/80 backdrop-blur-xl text-vscode-fg mr-4 border border-vscode-focusBorder/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)]'
      }`}
    >
      {/* Decorative Glow for AI */}
      {!isUser && (
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      )}
      {/* Sender Header */}
      <div className="flex items-center justify-between gap-1.5 mb-2 opacity-80 text-[11px] font-semibold uppercase tracking-wider select-none">
        <div className="flex items-center gap-2">
          {isUser ? (
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
              <User className="w-3 h-3 text-white" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-400/30 flex items-center justify-center shadow-sm">
              <Bot className="w-3 h-3 text-sky-400" />
            </div>
          )}
          <span className={isUser ? 'text-white font-bold' : 'text-sky-400 font-bold'}>
            {isUser ? 'You' : 'Chanakya AI Enhancer'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyMessage}
            className={`text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
              copied 
                ? 'bg-emerald-500/20 text-emerald-300' 
                : 'hover:bg-white/10 text-white/50 hover:text-white'
            }`}
            title="Copy message"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
          <span className="text-[10px] opacity-60 font-normal font-mono">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!isUser && (
            <button
              onClick={() => vscode.postMessage({ type: 'revertSnapshot' })}
              className="text-[10px] flex items-center gap-1 bg-red-500/20 text-red-300 hover:bg-red-500/40 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
              title="Revert workspace to before this prompt"
            >
              <Undo2 className="w-3 h-3" /> Revert
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Task Status Chips (Antigravity Style) */}
      {!isUser && (message.thought || message.isThinking) && (
        <div className="my-2">
          <div
            onClick={() => setShowThought(!showThought)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono cursor-pointer border border-vscode-border bg-vscode-badgeBg/10 text-vscode-fg hover:bg-vscode-badgeBg/20 transition-all select-none"
          >
            <span className="text-xs">🧠</span>
            <span className="font-semibold">
              {message.isThinking ? 'DeepSeek Reasoning in progress...' : 'DeepSeek Reasoning Process'}
            </span>
            {message.thoughtDurationMs ? (
              <span className="text-[10px] opacity-70">({(message.thoughtDurationMs / 1000).toFixed(1)}s)</span>
            ) : null}
            <span className="text-[10px] ml-1 opacity-70">{showThought ? '▲' : '▼'}</span>
          </div>

          {showThought && message.thought && (
            <div className="mt-1.5 p-3 rounded-lg border border-vscode-border bg-vscode-editorBg text-vscode-fg/90 text-[12px] font-mono leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
              {message.thought}
            </div>
          )}
        </div>
      )}

      {!isUser && message.taskStatuses && message.taskStatuses.length > 0 && (
        <div className="flex flex-col gap-1.5 my-2">
          {message.taskStatuses.map((task) => (
            <div
              key={task.id}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-mono border transition-all ${
                task.status === 'running'
                  ? 'bg-sky-500/10 border-sky-400/30 text-sky-300'
                  : task.status === 'error'
                  ? 'bg-red-500/10 border-red-400/30 text-red-300'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white/80'
              }`}
            >
              {task.status === 'running' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
              ) : task.status === 'error' ? (
                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-white/40" />
              )}
              <span className="flex-1">{task.label}</span>
              {task.durationMs ? (
                <span className="text-[10px] opacity-50 font-sans">
                  {task.status === 'running' ? (
                    <>Timed <DynamicTimer /></>
                  ) : (
                    `${(task.durationMs / 1000).toFixed(1)}s`
                  )}
                </span>
              ) : (
                task.status === 'running' && (
                  <span className="text-[10px] opacity-50 font-sans">
                    Timed <DynamicTimer />
                  </span>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {/* Context Item Pills */}
      {message.contextItems && message.contextItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 my-1.5 select-none">
          {message.contextItems.map((ci) => (
            <span
              key={ci.id}
              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-mono ${
                isUser
                  ? 'bg-black/25 text-white/90 border-white/20'
                  : 'bg-sky-500/10 text-sky-300 border-sky-400/30 shadow-sm'
              }`}
            >
              {ci.type === 'file' ? <FileText className="w-3 h-3 text-sky-400" /> : <Code className="w-3 h-3 text-emerald-400" />}
              <span className="truncate max-w-[180px]">{ci.name}</span>
            </span>
          ))}
        </div>
      )}

      {/* Markdown Content */}
      <div className="text-[13px] break-words prose-invert leading-relaxed">
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <>
            {blocks.map((block, i) => {
              if (block.type === 'tool') {
                if (block.parsed?.name === 'ask_user_options') {
                  const args = block.parsed.arguments || {};
                  return (
                    <div key={i} className="my-3 border border-vscode-border bg-vscode-badgeBg/10 rounded-xl overflow-hidden shadow-sm">
                      <div className="flex items-center gap-2 px-3 py-2 bg-vscode-badgeBg/20 border-b border-vscode-border font-mono text-[11px] font-bold text-vscode-fg">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Interactive Question</span>
                      </div>
                      <div className="p-3 text-sm text-white/90">
                        <div className="mb-3 font-medium text-[13px]">{args.question || 'Please select an option:'}</div>
                        <div className="flex flex-col gap-2">
                          {(args.options || []).map((opt: string, idx: number) => {
                            const isSelected = answeredTools[i] === opt;
                            const isAnswered = answeredTools[i] !== undefined;
                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  setAnsweredTools(prev => ({ ...prev, [i]: opt }));
                                  vscode.postMessage({ type: 'submitUserOption', payload: { choice: opt } });
                                }}
                                disabled={isAnswered}
                                className={`px-3 py-2 text-left text-[12px] rounded border transition-colors ${
                                  isSelected 
                                    ? 'bg-vscode-buttonBg border-vscode-buttonBorder text-vscode-buttonFg shadow-sm' 
                                    : 'border-vscode-border hover:bg-vscode-buttonHover text-vscode-fg/80 disabled:opacity-50 disabled:hover:bg-transparent cursor-pointer'
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={i} className="my-3 border border-vscode-border bg-vscode-editorBg rounded-xl overflow-hidden shadow-sm">
                    <div className="flex items-center gap-2 px-3 py-2 bg-vscode-badgeBg/10 border-b border-vscode-border font-mono text-[11px] font-bold text-vscode-fg">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{block.parsed?.name ? `Executing Tool: ${block.parsed.name}` : 'Preparing Tool...'}</span>
                      {!block.parsed && <Loader2 className="w-3 h-3 animate-spin ml-auto text-vscode-fg" />}
                    </div>
                    <div className="p-0 text-xs">
                      <CodeBlock 
                        language="json" 
                        value={block.parsed ? JSON.stringify(block.parsed.arguments || block.parsed, null, 2) : block.content.trim()} 
                        isStreaming={!block.parsed}
                        toolName={block.parsed?.name}
                        isToolBlock={true}
                      />
                    </div>
                  </div>
                );
              }

              return (
                <ReactMarkdown
                  key={i}
                  remarkPlugins={[remarkGfm]}
                  components={{
              code({ className, node, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                const isInline = !match && !String(children).includes('\n');
                
                if (isInline) {
                  return (
                    <code
                      className="px-1.5 py-0.5 rounded bg-black/40 text-sky-300 font-mono text-[12px] border border-white/10"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }

                const language = match ? match[1] : '';
                const codeString = String(children).replace(/\n$/, '');

                return <CodeBlock language={language} value={codeString} meta={node?.meta} isStreaming={message.isStreaming} />;
              },
              p({ children }) {
                return <p className="mb-2.5 last:mb-0 leading-relaxed text-white/90">{children}</p>;
              },
              ul({ children }) {
                return <ul className="list-disc list-inside space-y-1.5 my-2.5 pl-1 text-white/90">{children}</ul>;
              },
              ol({ children }) {
                return <ol className="list-decimal list-inside space-y-1.5 my-2.5 pl-1 text-white/90">{children}</ol>;
              },
              h1({ children }) {
                return <h1 className="text-base font-bold text-sky-300 mt-3.5 mb-2">{children}</h1>;
              },
              h2({ children }) {
                return <h2 className="text-sm font-bold text-sky-300 mt-3 mb-1.5">{children}</h2>;
              },
              h3({ children }) {
                return <h3 className="text-xs font-semibold text-sky-200 mt-2.5 mb-1">{children}</h3>;
              },
              blockquote({ children }) {
                return (
                  <blockquote className="border-l-2 border-sky-400 pl-3 my-2.5 italic text-white/80 bg-sky-500/5 py-1 rounded-r">
                    {children}
                  </blockquote>
                );
              },
              table({ children }) {
                return (
                  <div className="overflow-x-auto my-3 rounded-xl border border-white/10 bg-black/30 shadow-md">
                    <table className="min-w-full divide-y divide-white/10 text-xs">
                      {children}
                    </table>
                  </div>
                );
              },
              th({ children }) {
                return <th className="px-3 py-2 bg-white/5 font-bold text-sky-300 text-left">{children}</th>;
              },
              td({ children }) {
                return <td className="px-3 py-2 border-t border-white/5 text-white/85">{children}</td>;
              }
            }}
          >
            {block.content}
          </ReactMarkdown>
              );
            })}
          </>
        )}

        {/* Live Streaming Indicator */}
        {message.isStreaming && (
          <span className="inline-flex items-center gap-1.5 text-sky-400 font-mono text-xs ml-1 animate-pulse select-none">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span className="w-1.5 h-3.5 bg-sky-400 inline-block rounded-sm" />
          </span>
        )}
      </div>

      {/* Token Optimization Stats Card */}
      {!isUser && !message.isStreaming && message.optimizationStats && message.optimizationStats.originalTokens > message.optimizationStats.optimizedTokens && (
        <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-mono select-none shadow-sm">
          <ArrowDownRight className="w-3.5 h-3.5" />
          <div className="flex-1 flex justify-between items-center">
            <span>
              <span className="font-semibold text-emerald-400">
                {message.optimizationStats.originalTokens - message.optimizationStats.optimizedTokens}
              </span> tokens saved
            </span>
            <span className="bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-200">
              {Math.round(((message.optimizationStats.originalTokens - message.optimizationStats.optimizedTokens) / message.optimizationStats.originalTokens) * 100)}% optimized
            </span>
          </div>
        </div>
      )}

      {/* Inline Artifacts */}
      {!isUser && !message.isStreaming && message.artifacts && message.artifacts.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {message.artifacts.map((artifact, idx) => (
            <div 
              key={idx}
              onClick={() => onOpenArtifact && onOpenArtifact(artifact.name, artifact.content)}
              className="flex items-center gap-3 p-3 rounded-xl bg-black/20 hover:bg-black/40 border border-white/5 hover:border-white/10 cursor-pointer transition-all shadow-sm group"
            >
              <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 group-hover:scale-110 transition-transform">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="text-sm font-semibold text-white/90 truncate">{artifact.name === 'task.md' ? 'Task' : artifact.name === 'implementation_plan.md' ? 'Implementation Plan' : artifact.name === 'walkthrough.md' ? 'Walkthrough' : artifact.name}</div>
                <div className="text-[11px] text-white/50 truncate">Click to view artifact details</div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/70 transition-colors" />
            </div>
          ))}
        </div>
      )}

      {/* File Changes Summary */}
      {!isUser && !message.isStreaming && message.fileChanges && message.fileChanges.count > 0 && (
        <div className="mt-3 flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5 shadow-sm">
          <div className="flex items-center gap-3 text-sm text-white/80">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <span className="font-mono text-xs">
              {message.fileChanges.count} files changed <span className="text-emerald-400">+{message.fileChanges.added}</span> <span className="text-red-400">-{message.fileChanges.deleted}</span>
            </span>
          </div>
          <button 
            onClick={() => vscode.postMessage({ type: 'openSourceControl' })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded border border-emerald-500/20 transition-colors cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            Review
          </button>
        </div>
      )}

      {/* Message Footer (Telemetry & Actions) */}
      {!message.isStreaming && (
        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 select-none gap-2 flex-wrap">
          {!isUser && message.telemetry ? (
            <div className="flex items-center gap-2.5 text-[10px] font-mono text-white/50 overflow-x-auto py-0.5">
              {message.telemetry.tokensPerSec !== undefined && (
                <span className="flex items-center gap-1 text-sky-400 font-semibold">
                  <span>⚡</span>
                  <span>{message.telemetry.tokensPerSec} t/s</span>
                </span>
              )}
              {message.thoughtDurationMs !== undefined && (
                <span className="text-vscode-fg/60 font-medium">
                  🧠 {(message.thoughtDurationMs / 1000).toFixed(1)}s think
                </span>
              )}
              {message.telemetry.durationSec !== undefined && (
                <span>⏱️ {message.telemetry.durationSec}s</span>
              )}
              {message.telemetry.completionTokens !== undefined && (
                <span>📊 {message.telemetry.completionTokens} toks</span>
              )}
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-1">
            <button onClick={handleCopyMessage} className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer" title="Copy Message">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {!isUser && (
              <>
                <button className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer" title="Helpful">
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer" title="Not Helpful">
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
