import { useState, useMemo } from 'react';
import { X, Search, AtSign, FileUp, FolderGit2, Bot, BookOpen, Cloud, PlugZap } from 'lucide-react';
import { MENTIONS } from './mentionsData';

interface MentionItem {
  id: string;
  title: string;
  prompt: string;
  category: string;
}

export interface MentionHubModalProps {
  onClose: () => void;
  onSelectMention: (prompt: string) => void;
}

export function MentionHubModal({ onClose, onSelectMention }: MentionHubModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMentions = useMemo(() => {
    if (!searchQuery.trim()) return MENTIONS;
    const lowerQuery = searchQuery.toLowerCase();
    return MENTIONS.filter(
      (m: MentionItem) =>
        m.title.toLowerCase().includes(lowerQuery) ||
        m.category.toLowerCase().includes(lowerQuery)
    );
  }, [searchQuery]);

  const groupedMentions = useMemo(() => {
    const groups: Record<string, MentionItem[]> = {};
    for (const m of filteredMentions) {
      if (!groups[m.category]) groups[m.category] = [];
      groups[m.category].push(m);
    }
    return groups;
  }, [filteredMentions]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-vscode-editor-background border border-vscode-panel-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[40vh] flex flex-col overflow-hidden relative mt-auto mb-16">
        
        {/* Header */}
        <div className="p-4 border-b border-vscode-panel-border flex items-center justify-between bg-vscode-sideBar-background">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-green-500/20 text-green-400 rounded-lg">
              <AtSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-vscode-foreground">Mentions Hub</h2>
              <p className="text-[11px] text-vscode-descriptionForeground">Select contexts, agents, or integrations to include in your prompt</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-vscode-toolbar-hoverBackground rounded-md text-vscode-icon-foreground transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-vscode-panel-border bg-vscode-input-background/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vscode-input-placeholderForeground" />
            <input
              autoFocus
              type="text"
              placeholder="Search hundreds of contexts... (e.g. '@docs', '@workspace', 'Attach File')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-vscode-input-background border border-vscode-input-border text-vscode-input-foreground placeholder-vscode-input-placeholderForeground rounded-md py-2 pl-9 pr-3 text-[13px] outline-none focus:border-vscode-focusBorder focus:ring-1 focus:ring-vscode-focusBorder transition"
            />
          </div>
        </div>

        {/* Mentions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {Object.entries(groupedMentions).map(([category, mentions]) => (
            <div key={category} className="mb-4">
              <h3 className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-vscode-descriptionForeground mb-1 border-b border-vscode-panel-border pb-1">
                {category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 px-2">
                {mentions.map((mention: MentionItem) => {
                  let IconComponent = AtSign;
                  if (mention.id === 'mention-file-picker') IconComponent = FileUp;
                  else if (mention.category.includes('Core Contexts')) IconComponent = FolderGit2;
                  else if (mention.category.includes('Agents')) IconComponent = Bot;
                  else if (mention.category.includes('Documentation')) IconComponent = BookOpen;
                  else if (mention.category.includes('Cloud')) IconComponent = Cloud;
                  else if (mention.category.includes('External')) IconComponent = PlugZap;

                  const isFilePicker = mention.id === 'mention-file-picker';

                  return (
                    <button
                      key={mention.id}
                      onClick={() => onSelectMention(mention.prompt)}
                      className={`flex flex-col text-left p-3 rounded-lg border transition-all group ${
                        isFilePicker 
                          ? 'border-green-500/30 bg-green-500/10 hover:bg-green-500/20' 
                          : 'border-transparent hover:border-vscode-focusBorder bg-vscode-list-inactiveSelectionBackground hover:bg-vscode-list-hoverBackground'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-transform">
                          <IconComponent className={`w-4 h-4 ${isFilePicker ? 'text-green-400' : 'text-blue-400'}`} />
                        </div>
                        <span className="font-semibold text-[13px] text-vscode-foreground">
                          {mention.title}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          
          {filteredMentions.length === 0 && (
            <div className="p-8 text-center text-vscode-descriptionForeground">
              <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>No mentions found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
