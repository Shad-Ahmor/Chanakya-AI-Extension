import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '../../types/ipc';
import CodeBlock from './CodeBlock';
import { Code, FileText, Bot, User, Sparkles, Undo2, ArrowDownRight } from 'lucide-react';
import { vscode } from '../../vscode';

interface Props {
  message: ChatMessage;
}

export default function ChatMessageItem({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex flex-col p-4 rounded-2xl transition-all leading-relaxed relative overflow-hidden ${
        isUser
          ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500 text-white ml-6 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/20'
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
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
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

                return <CodeBlock language={language} value={codeString} />;
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
            {message.content}
          </ReactMarkdown>
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
    </div>
  );
}
