import { X, Check, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ArtifactModalProps {
  name: string;
  content: string;
  onClose: () => void;
  onProceed: () => void;
}

export function ArtifactModal({ name, content, onClose, onProceed }: ArtifactModalProps) {
  const isImplementationPlan = name.toLowerCase() === 'implementation_plan.md';

  return (
    <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex flex-col p-4 animate-in fade-in duration-200">
      <div className="flex-1 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-black/30 border-b border-white/10 flex justify-between items-center select-none shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/20 border border-sky-500/30">
              <FileText className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">{name}</h2>
              <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold mt-0.5">Virtual Artifact</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body - Markdown Rendering */}
        <div className="flex-1 overflow-y-auto p-6 bg-vscode-editor-background custom-scrollbar">
          <div className="max-w-3xl mx-auto prose prose-invert prose-sm prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-headings:text-white/90 prose-a:text-sky-400">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Footer actions for Implementation Plan */}
        {isImplementationPlan && (
          <div className="p-4 border-t border-white/10 bg-black/40 flex justify-end shrink-0">
            <button
              onClick={onProceed}
              className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg transition flex items-center gap-2 shadow-lg shadow-emerald-900/50 hover:shadow-emerald-900/80 font-bold"
            >
              <Check className="w-4 h-4" />
              <span>Approve & Proceed</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
