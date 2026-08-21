import { useState, useEffect } from 'react';
import { vscode } from '../../vscode';
import { Play, RotateCcw, Activity, Check, GitCommit } from 'lucide-react';

export default function SkillOpsView() {
  const [skills, setSkills] = useState<any[]>([]);
  const [activeSkillName, setActiveSkillName] = useState<string>('general');
  const [history, setHistory] = useState<any[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optResult, setOptResult] = useState<any>(null);

  useEffect(() => {
    vscode.postMessage({ type: 'skillOps:getSkills' });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'skillOps:skillsResult':
          setSkills(message.payload.skills);
          if (message.payload.skills.length > 0 && !activeSkillName) {
            setActiveSkillName(message.payload.skills[0].skillName);
          }
          break;
        case 'skillOps:historyResult':
          if (message.payload.skillName === activeSkillName) {
            setHistory(message.payload.history);
          }
          break;
        case 'skillOps:optimizationResult':
          setIsOptimizing(false);
          setOptResult(message.payload.result || { error: message.payload.error });
          vscode.postMessage({ type: 'skillOps:getSkills' });
          vscode.postMessage({ type: 'skillOps:getSkillHistory', payload: { skillName: activeSkillName } });
          break;
        case 'skillOps:rollbackResult':
          vscode.postMessage({ type: 'skillOps:getSkills' });
          vscode.postMessage({ type: 'skillOps:getSkillHistory', payload: { skillName: activeSkillName } });
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (activeSkillName) {
      vscode.postMessage({ type: 'skillOps:getSkillHistory', payload: { skillName: activeSkillName } });
    }
  }, [activeSkillName]);

  const runOptimization = () => {
    setIsOptimizing(true);
    setOptResult(null);
    vscode.postMessage({ type: 'skillOps:runOptimization', payload: { skillName: activeSkillName } });
  };

  const rollbackSkill = (version: number) => {
    vscode.postMessage({ type: 'skillOps:rollbackSkill', payload: { skillName: activeSkillName, version } });
  };

  const activeSkill = skills.find(s => s.skillName === activeSkillName);

  return (
    <div className="flex flex-col h-full overflow-hidden text-[var(--vscode-foreground)] p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">SkillOps Dashboard</h2>
        <div className="flex space-x-2">
          <select 
            value={activeSkillName} 
            onChange={(e) => setActiveSkillName(e.target.value)}
            className="bg-[var(--vscode-dropdown-background)] border border-[var(--vscode-dropdown-border)] text-[var(--vscode-dropdown-foreground)] px-2 py-1 rounded outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)]"
          >
            {skills.map(s => (
              <option key={s.skillName} value={s.skillName}>{s.skillName}</option>
            ))}
            {skills.length === 0 && <option value="general">general</option>}
          </select>
          <button 
            onClick={runOptimization}
            disabled={isOptimizing}
            className="flex items-center space-x-1 px-3 py-1.5 bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)] rounded font-medium disabled:opacity-50 transition-colors"
          >
            <Play className="w-4 h-4" />
            <span>{isOptimizing ? 'Optimizing...' : 'Run Optimization'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--vscode-editor-background)] border border-[var(--vscode-widget-border)] rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--vscode-descriptionForeground)] mb-2 flex items-center">
            <Activity className="w-4 h-4 mr-2" /> Current State
          </h3>
          {activeSkill ? (
            <div className="space-y-1">
              <p><span className="text-[var(--vscode-descriptionForeground)]">Skill:</span> {activeSkill.skillName}</p>
              <p><span className="text-[var(--vscode-descriptionForeground)]">Best Version:</span> v{activeSkill.bestVersion}</p>
            </div>
          ) : (
            <p className="text-[var(--vscode-descriptionForeground)] italic">No skill data loaded.</p>
          )}
        </div>

        <div className="bg-[var(--vscode-editor-background)] border border-[var(--vscode-widget-border)] rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--vscode-descriptionForeground)] mb-2 flex items-center">
            <Check className="w-4 h-4 mr-2" /> Last Optimization
          </h3>
          {optResult ? (
            optResult.error ? (
              <p className="text-[var(--vscode-errorForeground)]">{optResult.error}</p>
            ) : (
              <div className="space-y-1">
                <p>
                  <span className="text-[var(--vscode-descriptionForeground)]">Decision:</span>{' '}
                  <span className={optResult.decision === 'accepted' ? 'text-green-500 font-bold' : 'text-red-500 font-bold'}>
                    {optResult.decision.toUpperCase()}
                  </span>
                </p>
                <p><span className="text-[var(--vscode-descriptionForeground)]">Score Delta:</span> {optResult.scoreBefore?.toFixed(2)} → {optResult.scoreAfter?.toFixed(2)}</p>
                <p className="text-xs text-[var(--vscode-descriptionForeground)] truncate mt-1" title={optResult.reason}>{optResult.reason}</p>
              </div>
            )
          ) : (
            <p className="text-[var(--vscode-descriptionForeground)] italic">Run an optimization to see results.</p>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-[var(--vscode-editor-background)] border border-[var(--vscode-widget-border)] rounded-lg shadow-sm">
        <div className="px-4 py-3 border-b border-[var(--vscode-widget-border)] bg-[var(--vscode-sideBar-background)] rounded-t-lg">
          <h3 className="text-sm font-semibold uppercase tracking-wider flex items-center">
            <GitCommit className="w-4 h-4 mr-2" /> Version History
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length > 0 ? history.map((item, idx) => (
            <div key={idx} className="flex flex-col p-3 rounded border border-[var(--vscode-widget-border)] bg-[var(--vscode-sideBar-background)] relative group">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-lg">v{item.version}</span>
                  {item.status === 'best' && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full uppercase tracking-widest border border-green-500/30">Active Best</span>}
                  {item.status === 'archived' && <span className="text-[10px] bg-[var(--vscode-descriptionForeground)]/20 text-[var(--vscode-descriptionForeground)] px-2 py-0.5 rounded-full uppercase tracking-widest border border-[var(--vscode-descriptionForeground)]/30">Archived</span>}
                  {item.status === 'draft' && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full uppercase tracking-widest border border-yellow-500/30">Draft</span>}
                </div>
                {item.status !== 'best' && item.status !== 'draft' && (
                  <button
                    onClick={() => rollbackSkill(item.version)}
                    className="hidden group-hover:flex items-center space-x-1 text-xs px-2 py-1 bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] text-[var(--vscode-button-secondaryForeground)] rounded"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Rollback</span>
                  </button>
                )}
              </div>
              {item.changeDescription && (
                <p className="text-sm text-[var(--vscode-descriptionForeground)] mb-1 whitespace-pre-wrap">{item.changeDescription}</p>
              )}
              <div className="text-xs text-[var(--vscode-descriptionForeground)] opacity-70">
                Created: {new Date(item.createdAt).toLocaleString()}
              </div>
            </div>
          )) : (
            <div className="flex items-center justify-center h-full text-[var(--vscode-descriptionForeground)] italic">
              No version history available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
