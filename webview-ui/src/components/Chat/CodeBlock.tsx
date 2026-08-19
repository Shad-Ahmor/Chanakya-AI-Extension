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
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import { Copy, Check, ArrowDownToLine, Code2 } from 'lucide-react';
import { vscode } from '../../vscode';

interface CodeBlockProps {
  language?: string;
  value: string;
}

export default function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [inserted, setInserted] = useState(false);

  const lang = language ? language.toLowerCase().trim() : 'text';
  const lines = value.split('\n');

  useEffect(() => {
    Prism.highlightAll();
  }, [value, lang]);

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
