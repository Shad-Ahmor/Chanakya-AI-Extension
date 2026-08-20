import { useState, useMemo } from 'react';
import { X, Search, ScrollText, Shield, Sparkles, FileCode2, Layers, Cpu } from 'lucide-react';
import { RULES } from './rulesData';

interface RuleItem {
  id: string;
  title: string;
  description: string;
  rulePrompt: string;
  category: string;
}

export interface RulesHubModalProps {
  onClose: () => void;
  onSelectRule: (rulePrompt: string) => void;
}

export function RulesHubModal({ onClose, onSelectRule }: RulesHubModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return RULES;
    const lowerQuery = searchQuery.toLowerCase();
    return RULES.filter(
      (r) =>
        r.title.toLowerCase().includes(lowerQuery) ||
        r.description.toLowerCase().includes(lowerQuery) ||
        r.category.toLowerCase().includes(lowerQuery)
    );
  }, [searchQuery]);

  const groupedRules = useMemo(() => {
    const groups: Record<string, RuleItem[]> = {};
    for (const rule of filteredRules) {
      if (!groups[rule.category]) groups[rule.category] = [];
      groups[rule.category].push(rule);
    }
    return groups;
  }, [filteredRules]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-vscode-editor-background border border-vscode-panel-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[40vh] flex flex-col overflow-hidden relative mt-auto mb-16">
        
        {/* Header */}
        <div className="p-4 border-b border-vscode-panel-border flex items-center justify-between bg-vscode-sideBar-background">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-vscode-foreground">Rules Hub</h2>
              <p className="text-[11px] text-vscode-descriptionForeground">Select strict coding rules & guidelines to append to your prompt</p>
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
              placeholder="Search hundreds of rules... (e.g. 'Security', 'React', 'Clean Code')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-vscode-input-background border border-vscode-input-border text-vscode-input-foreground placeholder-vscode-input-placeholderForeground rounded-md py-2 pl-9 pr-3 text-[13px] outline-none focus:border-vscode-focusBorder focus:ring-1 focus:ring-vscode-focusBorder transition"
            />
          </div>
        </div>

        {/* Rule List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {Object.entries(groupedRules).map(([category, rules]) => (
            <div key={category} className="mb-4">
              <h3 className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-vscode-descriptionForeground mb-1 border-b border-vscode-panel-border pb-1">
                {category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 px-2 mt-2">
                {rules.map((rule: any) => {
                  let IconComponent = FileCode2;
                  if (rule.category.includes('Security')) IconComponent = Shield;
                  else if (rule.category.includes('Architecture')) IconComponent = Layers;
                  else if (rule.category.includes('Performance') || rule.category.includes('Database')) IconComponent = Cpu;
                  else if (rule.category.includes('Clean Code') || rule.category.includes('UI/UX')) IconComponent = Sparkles;

                  return (
                    <button
                      key={rule.id}
                      onClick={() => onSelectRule(rule.rulePrompt)}
                      className="flex flex-col text-left p-3 rounded-lg border border-transparent hover:border-vscode-focusBorder bg-vscode-list-inactiveSelectionBackground hover:bg-vscode-list-hoverBackground transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-transform">
                          <IconComponent className="w-4 h-4 text-blue-400" />
                        </div>
                        <span className="font-semibold text-[13px] text-vscode-foreground leading-tight">
                          {rule.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-vscode-descriptionForeground line-clamp-2 leading-relaxed">
                        {rule.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          
          {filteredRules.length === 0 && (
            <div className="p-8 text-center text-vscode-descriptionForeground">
              <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>No rules found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
