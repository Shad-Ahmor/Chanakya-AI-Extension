import { useState, useEffect } from 'react';
import { vscode } from '../../vscode';
import { Play, RotateCcw, Activity, GitCommit, Plus, Edit, Trash2, Download, Upload, ToggleLeft, ToggleRight, X } from 'lucide-react';

export default function SkillOpsView() {
  const [skills, setSkills] = useState<any[]>([]);
  const [activeSkillName, setActiveSkillName] = useState<string>('');
  const [history, setHistory] = useState<any[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optResult, setOptResult] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);
  
  // Optimization States
  const [optEpochs, setOptEpochs] = useState(3);
  const [optProgress, setOptProgress] = useState<any>(null);
  
  // Form States
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formContent, setFormContent] = useState('');

  useEffect(() => {
    vscode.postMessage({ type: 'skillOps:getSkills' });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'skillOps:skillsResult':
          setSkills(message.payload.skills);
          setSuggestions(message.payload.suggestions || []);
          if (message.payload.skills.length > 0 && !activeSkillName) {
            setActiveSkillName(message.payload.skills[0].skillName);
          } else if (message.payload.skills.length === 0) {
            setActiveSkillName('');
          }
          break;
        case 'skillOps:historyResult':
          if (message.payload.skillName === activeSkillName) {
            setHistory(message.payload.history);
          }
          break;
        case 'skillOps:optimizationProgress':
          setOptProgress(message.payload);
          break;
        case 'skillOps:optimizationResult':
          setIsOptimizing(false);
          setOptResult(message.payload.result || { error: message.payload.error });
          setOptProgress(null);
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
    setOptProgress(null);
    vscode.postMessage({ type: 'skillOps:runOptimization', payload: { skillName: activeSkillName, epochs: optEpochs } });
  };

  const rollbackSkill = (version: number) => {
    vscode.postMessage({ type: 'skillOps:rollbackSkill', payload: { skillName: activeSkillName, version } });
  };

  const activeSkill = skills.find(s => s.skillName === activeSkillName);

  const handleCreateSubmit = () => {
    if (!formName.trim() || !formContent.trim()) return;
    vscode.postMessage({
      type: 'skillOps:createSkill',
      payload: { category: formName, description: formDescription, content: formContent }
    });
    setShowCreateModal(false);
    setActiveSkillName(formName);
    setFormName('');
    setFormDescription('');
    setFormContent('');
  };

  const handleEditSubmit = () => {
    if (!activeSkillName || !formContent.trim()) return;
    vscode.postMessage({
      type: 'skillOps:updateSkill',
      payload: { category: activeSkillName, description: formDescription, content: formContent }
    });
    setShowEditModal(false);
    setFormDescription('');
    setFormContent('');
  };

  const handleDelete = (name: string) => {
    vscode.postMessage({ type: 'skillOps:deleteSkill', payload: { category: name } });
    if (activeSkillName === name) setActiveSkillName('');
  };

  const handleToggle = (name: string, currentEnabled: boolean) => {
    vscode.postMessage({ type: 'skillOps:toggleEnabled', payload: { category: name, enabled: !currentEnabled } });
  };

  const handleImport = () => {
    vscode.postMessage({ type: 'skillOps:importSkill' });
  };

  const handleExport = (name: string) => {
    vscode.postMessage({ type: 'skillOps:exportSkill', payload: { category: name } });
  };

  if (skills.length === 0 && !showCreateModal) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--vscode-foreground)] p-4 space-y-4">
        <Activity className="w-12 h-12 text-[var(--vscode-descriptionForeground)] opacity-50 mb-2" />
        <h2 className="text-xl font-bold">No skills created yet.</h2>
        <p className="text-[var(--vscode-descriptionForeground)] text-center max-w-sm">
          Skills define the specific behaviors and standard operating procedures for your AI agent.
        </p>
        <div className="flex gap-3 mt-4">
          <button 
            onClick={() => {
              setFormName('');
              setFormDescription('');
              setFormContent('');
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)] rounded font-medium flex items-center shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Skill
          </button>
          <button 
            onClick={handleImport}
            className="px-4 py-2 border border-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] text-[var(--vscode-foreground)] rounded font-medium flex items-center shadow-sm transition"
          >
            <Download className="w-4 h-4 mr-2" />
            Import Skill
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden text-[var(--vscode-foreground)] p-4 space-y-6 relative">
      
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-xl font-bold tracking-tight">SkillOps Dashboard</h2>
        <div className="flex gap-2">
          <button 
            onClick={handleImport}
            className="p-1.5 border border-transparent hover:border-[var(--vscode-widget-border)] hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded text-[var(--vscode-foreground)] transition"
            title="Import Skill from Markdown"
          >
            <Download className="w-4 h-4" />
          </button>
          <button 
            onClick={() => {
              setFormName('');
              setFormDescription('');
              setFormContent('');
              setShowCreateModal(true);
            }}
            className="flex items-center space-x-1 px-3 py-1.5 bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)] rounded font-medium shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Skill</span>
          </button>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="flex gap-4 flex-1 overflow-hidden">
        
        {/* Left Col: Skills List */}
        <div className="w-1/3 flex flex-col border border-[var(--vscode-widget-border)] rounded-lg bg-[var(--vscode-editor-background)] overflow-hidden shadow-sm shrink-0">
          <div className="px-3 py-2 border-b border-[var(--vscode-widget-border)] bg-[var(--vscode-sideBar-background)] font-semibold text-xs tracking-wider uppercase text-[var(--vscode-descriptionForeground)]">
            Active Skills
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {skills.map(s => (
              <div 
                key={s.skillName}
                onClick={() => setActiveSkillName(s.skillName)}
                className={`p-2 rounded cursor-pointer transition border ${activeSkillName === s.skillName ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)] border-[var(--vscode-list-activeSelectionBackground)]' : 'hover:bg-[var(--vscode-list-hoverBackground)] border-transparent'}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <div className={`font-bold text-sm truncate flex items-center gap-1 ${s.userDeleted ? 'opacity-50 line-through text-red-400' : ''}`}>
                    {s.skillName}
                    {suggestions.some(sg => sg.skillName === s.skillName) && (
                      <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse ml-1" title="Training suggested"></div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] px-1.5 py-0.5 bg-black/20 rounded font-mono">v{s.bestVersion}</span>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (!s.userDeleted) {
                          handleToggle(s.skillName, s.enabled !== false); 
                        }
                      }}
                      className={`opacity-70 hover:opacity-100 ${s.userDeleted ? 'cursor-not-allowed opacity-30' : ''}`}
                    >
                      {s.enabled !== false ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-gray-500" />}
                    </button>
                  </div>
                </div>
                {s.description && (
                  <div className="text-[10px] opacity-70 truncate" title={s.description}>{s.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Active Skill Detail */}
        {activeSkill ? (
          <div className="w-2/3 flex flex-col gap-4 overflow-y-auto pb-4">
            
            <div className="bg-[var(--vscode-editor-background)] border border-[var(--vscode-widget-border)] rounded-lg p-4 shadow-sm flex flex-col relative">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-xl font-extrabold flex items-center gap-2">
                    {activeSkill.skillName}
                  </h3>
                  {activeSkill.description && <p className="text-[var(--vscode-descriptionForeground)] mt-1 text-sm">{activeSkill.description}</p>}
                  
                  <div className="flex gap-4 text-xs mt-3 text-[var(--vscode-descriptionForeground)] font-medium">
                    <div className="flex items-center gap-1">
                      <span className="opacity-70">Source:</span> 
                      <span className="text-[var(--vscode-foreground)]">{activeSkill.source === 'SkillOps' ? 'SkillOps' : activeSkill.builtIn ? 'Built-in' : 'User Created'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="opacity-70">Version:</span> 
                      <span className="text-[var(--vscode-foreground)]">v{activeSkill.bestVersion}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="opacity-70">Score:</span> 
                      <span className="text-[var(--vscode-foreground)]">
                        {activeSkill.versions?.find((v: any) => v.version === activeSkill.bestVersion)?.score ? `${(activeSkill.versions.find((v: any) => v.version === activeSkill.bestVersion).score * 100).toFixed(0)}%` : 'N/A'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs mt-2 font-medium">
                    <span className="text-[var(--vscode-descriptionForeground)] opacity-70">Status:</span>
                    {activeSkill.userDeleted ? (
                      <span className="flex items-center gap-1 text-red-400"><div className="w-2 h-2 rounded-full bg-red-400"></div> Deleted</span>
                    ) : activeSkill.enabled === false ? (
                      <span className="flex items-center gap-1 text-yellow-400"><div className="w-2 h-2 rounded-full bg-yellow-400"></div> Disabled</span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-400"><div className="w-2 h-2 rounded-full bg-emerald-400"></div> Active</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1 bg-[var(--vscode-editor-background)] p-1 rounded-md border border-[var(--vscode-widget-border)]">
                   <button 
                    onClick={() => {
                      setFormDescription(activeSkill.description || '');
                      setFormContent(activeSkill.content || '');
                      setShowEditModal(true);
                    }}
                    disabled={activeSkill.userDeleted}
                    className="p-1.5 hover:bg-sky-500/20 hover:text-sky-400 rounded transition disabled:opacity-30 disabled:cursor-not-allowed" title="Edit New Version"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => handleExport(activeSkill.skillName)}
                    className="p-1.5 hover:bg-emerald-500/20 hover:text-emerald-400 rounded transition" title="Export Markdown"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm(activeSkill.builtIn ? 'Soft-delete this built-in skill? (It can be restored later)' : 'Delete this skill entirely?')) {
                        handleDelete(activeSkill.skillName);
                      }
                    }}
                    disabled={activeSkill.userDeleted}
                    className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded transition disabled:opacity-30 disabled:cursor-not-allowed" title="Delete Skill"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {suggestions.find(sg => sg.skillName === activeSkill.skillName) && (
                <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-md flex items-start gap-3 text-sm">
                  <Activity className="w-5 h-5 text-purple-400 mt-0.5 shrink-0 animate-pulse" />
                  <div>
                    <h4 className="font-bold text-purple-300">Optimization Recommended</h4>
                    <p className="text-[var(--vscode-descriptionForeground)] mt-1">
                      This skill has failed {suggestions.find(sg => sg.skillName === activeSkill.skillName)?.failedTasksCount} recent tasks. Consider running the optimizer.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {activeSkill.userDeleted ? (
                  <button 
                    onClick={() => {
                      if (confirm('Restore this deleted built-in skill?')) {
                        vscode.postMessage({ type: 'skillOps:restoreBuiltIn', payload: { category: activeSkill.skillName } });
                      }
                    }}
                    className="flex items-center space-x-1 px-4 py-2 bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)] rounded-md font-medium transition shadow-md"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Restore</span>
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={() => setShowOptimizeModal(true)}
                      disabled={isOptimizing || activeSkill.enabled === false}
                      className="flex items-center space-x-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white rounded-md font-medium disabled:opacity-50 transition shadow-md"
                    >
                      <Play className="w-4 h-4" />
                      <span>{isOptimizing ? 'Optimizing...' : 'Optimize Skill'}</span>
                    </button>
                    {activeSkill.builtIn && activeSkill.userModified && (
                      <button 
                        onClick={() => {
                          if (confirm('Restore the original built-in skill? Your current modifications will be kept in version history.')) {
                            vscode.postMessage({ type: 'skillOps:restoreBuiltIn', payload: { category: activeSkill.skillName } });
                          }
                        }}
                        className="flex items-center space-x-1 px-4 py-2 bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] text-[var(--vscode-foreground)] rounded-md font-medium transition shadow-sm"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Restore Built-in</span>
                      </button>
                    )}
                  </>
                )}
              </div>

              {optResult && (
                <div className="mt-4 p-3 bg-black/20 border border-white/5 rounded-md text-xs">
                  {optResult.error ? (
                    <p className="text-red-400">{optResult.error}</p>
                  ) : (
                    <div className="space-y-1">
                      <p>
                        <span className="text-[var(--vscode-descriptionForeground)]">Optimization Decision:</span>{' '}
                        <span className={optResult.decision === 'accepted' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                          {optResult.decision.toUpperCase()}
                        </span>
                      </p>
                      <p><span className="text-[var(--vscode-descriptionForeground)]">Score Change:</span> {optResult.scoreBefore?.toFixed(2)} → {optResult.scoreAfter?.toFixed(2)}</p>
                      <p className="text-[var(--vscode-descriptionForeground)] truncate" title={optResult.reason}>Reason: {optResult.reason}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Version History List */}
            <div className="flex-1 flex flex-col min-h-0 bg-[var(--vscode-editor-background)] border border-[var(--vscode-widget-border)] rounded-lg shadow-sm">
              <div className="px-4 py-2 border-b border-[var(--vscode-widget-border)] bg-[var(--vscode-sideBar-background)] rounded-t-lg">
                <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center text-[var(--vscode-descriptionForeground)]">
                  <GitCommit className="w-3.5 h-3.5 mr-2" /> Version History
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {history.length > 0 ? history.map((item, idx) => (
                  <div key={idx} className="flex flex-col p-2.5 rounded border border-[var(--vscode-widget-border)] bg-[var(--vscode-sideBar-background)] relative group">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm">v{item.version}</span>
                        {item.status === 'best' && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-sm uppercase tracking-widest border border-green-500/30">Active</span>}
                        {item.status === 'archived' && <span className="text-[9px] bg-[var(--vscode-descriptionForeground)]/20 text-[var(--vscode-descriptionForeground)] px-1.5 py-0.5 rounded-sm uppercase tracking-widest">Archived</span>}
                      </div>
                      {item.status !== 'best' && item.status !== 'draft' && (
                        <button
                          onClick={() => rollbackSkill(item.version)}
                          className="hidden group-hover:flex items-center space-x-1 text-[10px] px-2 py-0.5 bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] rounded"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Rollback</span>
                        </button>
                      )}
                    </div>
                    {item.changeDescription && (
                      <p className="text-xs text-[var(--vscode-descriptionForeground)] mb-1">{item.changeDescription}</p>
                    )}
                    <div className="flex justify-between text-[10px] text-[var(--vscode-descriptionForeground)] opacity-70">
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                      {item.score !== undefined && <span>Score: {item.score.toFixed(2)}</span>}
                    </div>
                  </div>
                )) : (
                  <div className="text-center p-4 text-[var(--vscode-descriptionForeground)] italic text-xs">
                    No version history available.
                  </div>
                )}
              </div>
            </div>

          </div>
        ) : (
          <div className="w-2/3 flex items-center justify-center border border-[var(--vscode-widget-border)] rounded-lg bg-[var(--vscode-editor-background)] text-[var(--vscode-descriptionForeground)] text-sm italic">
            Select a skill to view details.
          </div>
        )}

      </div>

      {/* Modals */}
      {(showCreateModal || showEditModal) && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--vscode-editor-background)] border border-[var(--vscode-widget-border)] rounded-xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden max-h-full">
            <div className="px-4 py-3 border-b border-[var(--vscode-widget-border)] bg-black/20 flex justify-between items-center">
              <h3 className="font-bold text-base">{showCreateModal ? 'Create New Skill' : `Edit Skill: ${activeSkill?.skillName}`}</h3>
              <button 
                onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                className="hover:text-red-400 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto">
              {showCreateModal && (
                <div>
                  <label className="block text-xs font-bold mb-1">Skill Name</label>
                  <input 
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="e.g., Coding, CodeReview"
                    className="w-full bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded px-3 py-1.5 text-sm outline-none focus:border-[var(--vscode-focusBorder)]"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold mb-1">Description (Optional)</label>
                <input 
                  type="text"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="What does this skill do?"
                  className="w-full bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded px-3 py-1.5 text-sm outline-none focus:border-[var(--vscode-focusBorder)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Markdown Content</label>
                <p className="text-[10px] text-[var(--vscode-descriptionForeground)] mb-2">
                  Define the skill rules, constraints, and instructions using Markdown. If you are editing an existing skill, you must rewrite the content for the new version.
                </p>
                <textarea 
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  placeholder="# Skill Instructions&#10;- Rule 1&#10;- Rule 2"
                  className="w-full h-48 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--vscode-focusBorder)] font-mono resize-none"
                />
              </div>
            </div>

            <div className="px-4 py-3 border-t border-[var(--vscode-widget-border)] bg-black/20 flex justify-end gap-2">
              <button 
                onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                className="px-4 py-1.5 text-sm font-medium hover:bg-white/10 rounded transition"
              >
                Cancel
              </button>
              <button 
                onClick={showCreateModal ? handleCreateSubmit : handleEditSubmit}
                disabled={(showCreateModal && !formName.trim()) || !formContent.trim()}
                className="px-4 py-1.5 text-sm font-medium bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)] rounded transition disabled:opacity-50"
              >
                Save Skill
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Optimize Modal */}
      {showOptimizeModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--vscode-editor-background)] border border-[var(--vscode-widget-border)] rounded-xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--vscode-widget-border)] bg-black/20 flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Play className="w-4 h-4 text-purple-400" />
                Train Skill: {activeSkill?.skillName}
              </h3>
              {!isOptimizing && (
                <button onClick={() => setShowOptimizeModal(false)} className="hover:text-red-400 transition">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="p-5 space-y-4">
              {!isOptimizing ? (
                <>
                  <div className="flex justify-between items-center bg-black/20 p-3 rounded border border-white/5">
                    <div>
                      <div className="text-xs text-[var(--vscode-descriptionForeground)] uppercase tracking-wider font-semibold">Current Version</div>
                      <div className="text-lg font-bold">v{activeSkill?.bestVersion}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-[var(--vscode-descriptionForeground)] uppercase tracking-wider font-semibold">Base Score</div>
                      <div className="text-lg font-bold text-emerald-400">
                        {activeSkill?.versions?.find((v: any) => v.version === activeSkill?.bestVersion)?.score ? `${(activeSkill.versions.find((v: any) => v.version === activeSkill.bestVersion).score * 100).toFixed(0)}%` : 'N/A'}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold mb-2">Training Epochs</label>
                    <input 
                      type="number" 
                      min="1" max="10"
                      value={optEpochs}
                      onChange={e => setOptEpochs(parseInt(e.target.value) || 1)}
                      className="w-full bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded px-3 py-2 text-sm outline-none focus:border-[var(--vscode-focusBorder)]"
                    />
                    <p className="text-[10px] text-[var(--vscode-descriptionForeground)] mt-1">
                      More epochs take longer but allow the optimizer more attempts to find a robust improvement.
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-center py-4">
                    <Activity className="w-12 h-12 text-purple-400 animate-pulse" />
                  </div>
                  
                  {optProgress ? (
                    <div className="bg-black/20 p-4 rounded-lg border border-purple-500/30">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm text-purple-300">Epoch {optProgress.epoch} / {optProgress.maxEpochs}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium">
                          {optProgress.stage}
                        </span>
                      </div>
                      
                      {optProgress.scoreBefore !== undefined && optProgress.scoreAfter !== undefined && (
                        <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
                          <div className="text-center">
                            <div className="text-[10px] text-[var(--vscode-descriptionForeground)] uppercase">Old Score</div>
                            <div className="font-mono text-sm">{(optProgress.scoreBefore * 100).toFixed(1)}%</div>
                          </div>
                          <div className="text-[var(--vscode-descriptionForeground)]">→</div>
                          <div className="text-center">
                            <div className="text-[10px] text-[var(--vscode-descriptionForeground)] uppercase">New Score</div>
                            <div className={`font-mono text-sm font-bold ${optProgress.scoreAfter > optProgress.scoreBefore ? 'text-emerald-400' : 'text-red-400'}`}>
                              {(optProgress.scoreAfter * 100).toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-sm text-[var(--vscode-descriptionForeground)]">
                      Initializing optimizer...
                    </div>
                  )}
                  
                  {optResult && (
                    <div className="mt-2 text-center text-sm font-bold text-emerald-400">
                      Optimization Complete!
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-[var(--vscode-widget-border)] bg-black/20 flex justify-end gap-2">
              {!isOptimizing ? (
                <>
                  <button 
                    onClick={() => setShowOptimizeModal(false)}
                    className="px-4 py-1.5 text-sm font-medium hover:bg-white/10 rounded transition"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={runOptimization}
                    className="px-4 py-1.5 text-sm font-medium bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white rounded transition shadow-md flex items-center"
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5" /> Start Training
                  </button>
                </>
              ) : optResult ? (
                <button 
                  onClick={() => { setShowOptimizeModal(false); setOptResult(null); }}
                  className="px-4 py-1.5 text-sm font-medium bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)] rounded transition"
                >
                  Close
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
