import { useState, useEffect } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-css';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import { Copy, Check, ArrowDownToLine, Code2, Sparkles } from 'lucide-react';
import { vscode } from '../../vscode';

interface CodeBlockProps {
  language?: string;
  value: string;
  meta?: string;
  isStreaming?: boolean;
  toolName?: string;
}

export default function CodeBlock({ language, value, meta, isStreaming, toolName }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [inserted, setInserted] = useState(false);
  const [applied, setApplied] = useState(false);
  const [filePath, setFilePath] = useState<string | null>(null);

  const lang = language ? language.toLowerCase().trim() : 'text';
  const lines = value.split('\n');

  useEffect(() => {
    Prism.highlightAll();
  }, [value, lang]);

  // Extract file path from meta or first line
  useEffect(() => {
    let extractedPath = null;
    if (meta) {
      const match = /file=["']?([^"'\s]+)["']?/.exec(meta);
      if (match) extractedPath = match[1];
    }
    if (!extractedPath && lines.length > 0) {
      const firstLine = lines[0].trim();
      const commentMatch = /^(?:\/\/|#|<!--|\/\*)\s*file:\s*([^\s]+)/i.exec(firstLine);
      if (commentMatch) extractedPath = commentMatch[1];
    }
    setFilePath(extractedPath);
  }, [meta, lines[0]]);

  // Stream file edit
  useEffect(() => {
    if (filePath && value) {
      const timeoutId = setTimeout(() => {
        vscode.postMessage({
          type: 'streamFileEdit',
          payload: { path: filePath, code: value, isStreaming: !!isStreaming }
        });
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [value, filePath, isStreaming]);

  const handleCopy = () => {
    vscode.postMessage({
      type: 'copyToClipboard',
      payload: { text: value }
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    vscode.postMessage({
      type: 'insertCode',
      payload: { code: value }
    });
    setInserted(true);
    setTimeout(() => setInserted(false), 2000);
  };

  const handleApply = () => {
    let finalToolName = toolName;
    let finalArgsString = value;

    // Fallback: If toolName is missing (e.g. parsing failed or still streaming), try to parse the JSON manually
    if (!finalToolName) {
      try {
        const parsed = JSON.parse(value);
        if (parsed.name && parsed.arguments) {
          finalToolName = parsed.name;
          finalArgsString = typeof parsed.arguments === 'string' ? parsed.arguments : JSON.stringify(parsed.arguments);
        }
      } catch (e) {
        // ignore
      }
    }

    if (finalToolName) {
      vscode.postMessage({
        type: 'executeToolManual',
        payload: { toolName: finalToolName, argsString: finalArgsString }
      });
    } else {
      vscode.postMessage({
        type: 'applyCodeMerge',
        payload: { code: value }
      });
    }
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  let highlightedHtml = '';
  try {
    const grammar = Prism.languages[lang] || Prism.languages.javascript || Prism.languages.text;
    highlightedHtml = Prism.highlight(value, grammar, lang);
  } catch {
    highlightedHtml = value;
  }

  return (
    <div className="my-3 rounded-xl border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden text-[12px] shadow-lg transition-all hover:border-white/20">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-white/[0.03] border-b border-white/10 select-none">
        <div className="flex items-center gap-2">
          <Code2 className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-400/20">
            {lang}
          </span>
          <span className="text-[10px] text-white/40 font-mono">
            {lines.length} {lines.length === 1 ? 'line' : 'lines'}
          </span>
          {filePath && (
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-400/30 flex items-center gap-1 font-mono ml-1">
              <Sparkles className="w-3 h-3" /> Auto-Syncing: {filePath}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            title="Copy code to clipboard"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-white/70 hover:text-white hover:bg-white/10 transition border border-transparent hover:border-white/10"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            onClick={handleApply}
            title="Smart merge code into active editor using Diff View"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold text-purple-300 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-400/30 transition shadow-sm ml-1"
          >
            {applied ? (
              <>
                <Check className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-purple-400">Applied</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Apply</span>
              </>
            )}
          </button>

          <button
            onClick={handleInsert}
            title="Insert code directly into active editor cursor / selection"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-sky-300 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 transition shadow-sm"
          >
            {inserted ? (
              <>
                <Check className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-sky-400 font-semibold">Inserted</span>
              </>
            ) : (
              <>
                <ArrowDownToLine className="w-3.5 h-3.5 text-sky-400" />
                <span>Insert</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Body */}
      <div className="p-3.5 overflow-x-auto font-mono text-[12px] leading-relaxed bg-black/20">
        <pre className="!m-0 !p-0 !bg-transparent">
          <code
            className={`language-${lang}`}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </pre>
      </div>
    </div>
  );
}