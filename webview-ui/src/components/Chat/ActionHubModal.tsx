import { useState, useMemo } from 'react';
import { X, Search, Zap, Shield, Wrench, BookOpen, Terminal, Sparkles } from 'lucide-react';
import { ACTIONS } from './actionsData';

interface ActionItem {
  id: string;
  title: string;
  prompt: string;
  category: string;
}

export interface ActionHubModalProps {
  onClose: () => void;
  onSelectAction: (prompt: string) => void;
}

export function ActionHubModal({ onClose, onSelectAction }: ActionHubModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredActions = useMemo(() => {
    if (!searchQuery.trim()) return ACTIONS;
    const lowerQuery = searchQuery.toLowerCase();
    return ACTIONS.filter(
      (a) =>
        a.title.toLowerCase().includes(lowerQuery) ||
        a.prompt.toLowerCase().includes(lowerQuery) ||
        a.category.toLowerCase().includes(lowerQuery)
    );
  }, [searchQuery]);

  // Group by category
  const groupedActions = useMemo(() => {
    const groups: Record<string, ActionItem[]> = {};
    for (const action of filteredActions) {
      if (!groups[action.category]) groups[action.category] = [];
      groups[action.category].push(action);
    }
    return groups;
  }, [filteredActions]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-vscode-editor-background border border-vscode-panel-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[40vh] flex flex-col overflow-hidden relative mt-auto mb-16">
        
        {/* Header */}
        <div className="p-4 border-b border-vscode-panel-border flex items-center justify-between bg-vscode-sideBar-background">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-vscode-foreground">Action Hub</h2>
              <p className="text-[11px] text-vscode-descriptionForeground">Select a popular agentic action to execute</p>
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
              placeholder="Search hundreds of actions... (e.g. 'Django', 'Security', 'Refactor')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-vscode-input-background border border-vscode-input-border text-vscode-input-foreground placeholder-vscode-input-placeholderForeground rounded-md py-2 pl-9 pr-3 text-[13px] outline-none focus:border-vscode-focusBorder focus:ring-1 focus:ring-vscode-focusBorder transition"
            />
          </div>
        </div>

        {/* Action List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {Object.entries(groupedActions).map(([category, actions]) => (
            <div key={category} className="mb-4">
              <h3 className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-vscode-descriptionForeground mb-1">
                {category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 px-2">
                {actions.map((action: any) => {
                  let IconComponent = Sparkles;
                  if (action.category.includes('Scans')) IconComponent = Shield;
                  else if (action.category.includes('Scaffolding')) IconComponent = Terminal;
                  else if (action.category.includes('Refactoring')) IconComponent = Wrench;
                  else if (action.category.includes('Documentation')) IconComponent = BookOpen;

                  return (
                    <button
                      key={action.id}
                      onClick={() => onSelectAction(action.prompt)}
                      className="flex flex-col text-left p-3 rounded-lg border border-transparent hover:border-vscode-focusBorder bg-vscode-list-inactiveSelectionBackground hover:bg-vscode-list-hoverBackground transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-transform">
                          <IconComponent className="w-4 h-4 text-blue-400" />
                        </div>
                        <span className="font-semibold text-[13px] text-vscode-foreground">
                          {action.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-vscode-descriptionForeground line-clamp-2 leading-relaxed">
                        {action.prompt}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          
          {filteredActions.length === 0 && (
            <div className="p-8 text-center text-vscode-descriptionForeground">
              <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>No actions found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
