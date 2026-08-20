import { useState, useMemo } from 'react';
import { X, Search, Target, Rocket, ShieldCheck, TestTube2, ServerCog, Briefcase } from 'lucide-react';
import { GOALS } from './goalsData';

interface GoalItem {
  id: string;
  title: string;
  prompt: string;
  category: string;
}

export interface GoalHubModalProps {
  onClose: () => void;
  onSelectGoal: (prompt: string) => void;
}

export function GoalHubModal({ onClose, onSelectGoal }: GoalHubModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGoals = useMemo(() => {
    if (!searchQuery.trim()) return GOALS;
    const lowerQuery = searchQuery.toLowerCase();
    return GOALS.filter(
      (g: GoalItem) =>
        g.title.toLowerCase().includes(lowerQuery) ||
        g.prompt.toLowerCase().includes(lowerQuery) ||
        g.category.toLowerCase().includes(lowerQuery)
    );
  }, [searchQuery]);

  const groupedGoals = useMemo(() => {
    const groups: Record<string, GoalItem[]> = {};
    for (const g of filteredGoals) {
      if (!groups[g.category]) groups[g.category] = [];
      groups[g.category].push(g);
    }
    return groups;
  }, [filteredGoals]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-vscode-editor-background border border-vscode-panel-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[40vh] flex flex-col overflow-hidden relative mt-auto mb-16">
        
        {/* Header */}
        <div className="p-4 border-b border-vscode-panel-border flex items-center justify-between bg-vscode-sideBar-background">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-red-500/20 text-red-400 rounded-lg">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-vscode-foreground">Goal Hub</h2>
              <p className="text-[11px] text-vscode-descriptionForeground">Select autonomous, long-running agentic goals (/goal)</p>
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
              placeholder="Search hundreds of long-running autonomous goals... (e.g. 'Migration', 'Security')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-vscode-input-background border border-vscode-input-border text-vscode-input-foreground placeholder-vscode-input-placeholderForeground rounded-md py-2 pl-9 pr-3 text-[13px] outline-none focus:border-vscode-focusBorder focus:ring-1 focus:ring-vscode-focusBorder transition"
            />
          </div>
        </div>

        {/* Goals List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {Object.entries(groupedGoals).map(([category, goals]) => (
            <div key={category} className="mb-4">
              <h3 className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-vscode-descriptionForeground mb-1 border-b border-vscode-panel-border pb-1">
                {category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 px-2">
                {goals.map((goal: GoalItem) => {
                  let IconComponent = Rocket;
                  if (category.includes('Migrations')) IconComponent = Briefcase;
                  else if (category.includes('Security')) IconComponent = ShieldCheck;
                  else if (category.includes('Testing')) IconComponent = TestTube2;
                  else if (category.includes('DevOps')) IconComponent = ServerCog;

                  return (
                    <button
                      key={goal.id}
                      onClick={() => onSelectGoal(goal.prompt)}
                      className="flex flex-col text-left p-3 rounded-lg border border-transparent hover:border-vscode-focusBorder bg-vscode-list-inactiveSelectionBackground hover:bg-vscode-list-hoverBackground transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-transform">
                          <IconComponent className="w-4 h-4 text-red-400" />
                        </div>
                        <span className="font-semibold text-[13px] text-vscode-foreground">
                          {goal.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-vscode-descriptionForeground line-clamp-2 leading-relaxed">
                        {goal.prompt}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          
          {filteredGoals.length === 0 && (
            <div className="p-8 text-center text-vscode-descriptionForeground">
              <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>No goals found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
