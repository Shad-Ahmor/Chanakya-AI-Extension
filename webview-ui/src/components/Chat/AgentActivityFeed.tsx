import React from 'react';
import { AgentActivity } from '../../../../src/types/ipc';

interface AgentActivityFeedProps {
  activities: AgentActivity[];
}

export const AgentActivityFeed: React.FC<AgentActivityFeedProps> = ({ activities }) => {
  if (!activities || activities.length === 0) {
    return null;
  }

  const getActivityIcon = (type: string, status: string) => {
    if (status === 'failed') return 'codicon-error';
    switch (type) {
      case 'search': return 'codicon-search';
      case 'analyze': return 'codicon-file-code';
      case 'edit': return 'codicon-edit';
      case 'create': return 'codicon-new-file';
      case 'delete': return 'codicon-trash';
      case 'command': return 'codicon-terminal';
      default: return 'codicon-gear';
    }
  };

  return (
    <div className="agent-activity-feed" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {activities.map((activity) => (
        <div 
          key={activity.id} 
          className={`agent-activity-item status-${activity.status}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            padding: '8px 12px',
            backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
            borderRadius: '6px',
            border: '1px solid var(--vscode-widget-border)',
            fontSize: '12px',
            fontFamily: 'var(--vscode-editor-font-family)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--vscode-foreground)' }}>
              <i className={`codicon ${getActivityIcon(activity.type, activity.status)} ${activity.status === 'running' ? 'codicon-modifier-spin' : ''}`}></i>
              <span style={{ fontWeight: 600 }}>{activity.title}</span>
            </div>
            <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '11px' }}>
              {activity.status === 'running' ? (
                'Working...'
              ) : activity.status === 'failed' ? (
                <span style={{ color: 'var(--vscode-errorForeground)' }}>Failed</span>
              ) : (
                `Done ${activity.durationMs ? `(${activity.durationMs}ms)` : ''}`
              )}
            </div>
          </div>
          {activity.filePath && (
            <div style={{ color: 'var(--vscode-descriptionForeground)', wordBreak: 'break-all' }}>
              <i className="codicon codicon-file" style={{ marginRight: '4px', fontSize: '11px' }}></i>
              {activity.filePath}
            </div>
          )}
          {activity.command && (
            <div style={{ 
              backgroundColor: 'var(--vscode-textCodeBlock-background)', 
              padding: '4px 8px', 
              borderRadius: '4px',
              fontFamily: 'monospace',
              marginTop: '4px',
              color: 'var(--vscode-textPreformat-foreground)'
            }}>
              $ {activity.command}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
