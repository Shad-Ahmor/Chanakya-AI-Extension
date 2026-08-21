import React, { useState } from 'react';
import { vscode } from '../../vscode';

export interface PlanTaskItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  description?: string;
  durationMs?: number;
}

export interface PlanState {
  planId: string;
  title: string;
  tasks: PlanTaskItem[];
  currentTaskId: string | null;
  overallProgress: number;
  updatedAt: number;
}

interface TaskPlanHUDProps {
  plan: PlanState | null;
  onDismiss?: () => void;
}

export const TaskPlanHUD: React.FC<TaskPlanHUDProps> = ({ plan, onDismiss }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!plan || !plan.tasks || plan.tasks.length === 0) {
    return null;
  }

  const completedTasks = plan.tasks.filter((t) => t.status === 'completed').length;
  const totalTasks = plan.tasks.length;

  const handleToggleTask = (taskId: string, currentStatus: PlanTaskItem['status']) => {
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    vscode.postMessage({
      type: 'setTaskStatus',
      payload: { taskId, status: nextStatus }
    });
  };

  return (
    <div
      style={{
        margin: '8px 12px 12px 12px',
        backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground, rgba(30, 41, 59, 0.7))',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--vscode-focusBorder, #3b82f6)',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden',
        transition: 'all 0.3s ease'
      }}
    >
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          borderBottom: isExpanded ? '1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))' : 'none',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '14px' }}>🎯</span>
          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--vscode-editor-foreground, #f1f5f9)' }}>
            {plan.title || 'Active Execution Plan'}
          </span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: 12,
              backgroundColor: 'var(--vscode-badge-background, #2563eb)',
              color: 'var(--vscode-badge-foreground, #ffffff)',
              fontWeight: 500
            }}
          >
            {completedTasks}/{totalTasks} ({plan.overallProgress}%)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onDismiss && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--vscode-descriptionForeground, #94a3b8)',
                cursor: 'pointer',
                padding: '2px 4px',
                fontSize: '14px',
                lineHeight: 1
              }}
              title="Dismiss Plan"
            >
              ✕
            </button>
          )}
          <span style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground, #94a3b8)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
            ▼
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ height: 3, width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.08)' }}>
        <div
          style={{
            height: '100%',
            width: `${plan.overallProgress}%`,
            backgroundColor: plan.overallProgress === 100 ? '#10b981' : '#3b82f6',
            transition: 'width 0.4s ease'
          }}
        />
      </div>

      {/* Task List */}
      {isExpanded && (
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
          {plan.tasks.map((task, idx) => {
            const isInProgress = task.status === 'in_progress';
            const isCompleted = task.status === 'completed';
            const isFailed = task.status === 'failed';

            return (
              <div
                key={task.id || idx}
                onClick={() => handleToggleTask(task.id, task.status)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  backgroundColor: isInProgress
                    ? 'rgba(59, 130, 246, 0.15)'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: isInProgress
                    ? '1px solid rgba(59, 130, 246, 0.4)'
                    : '1px solid transparent',
                  transition: 'background 0.2s ease'
                }}
              >
                {/* Status Icon */}
                <div style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isCompleted ? (
                    <span style={{ color: '#10b981', fontSize: '13px' }}>✓</span>
                  ) : isFailed ? (
                    <span style={{ color: '#ef4444', fontSize: '13px' }}>✗</span>
                  ) : isInProgress ? (
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3b82f6', animation: 'pulse 1.5s infinite' }} />
                  ) : (
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', border: '1px solid #64748b' }} />
                  )}
                </div>

                {/* Title */}
                <span
                  style={{
                    fontSize: '12px',
                    flex: 1,
                    textDecoration: isCompleted ? 'line-through' : 'none',
                    color: isCompleted
                      ? 'var(--vscode-descriptionForeground, #94a3b8)'
                      : isInProgress
                      ? '#60a5fa'
                      : 'var(--vscode-editor-foreground, #e2e8f0)',
                    fontWeight: isInProgress ? 600 : 400
                  }}
                >
                  {task.title}
                </span>

                {/* Status Tag */}
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: 4,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    backgroundColor: isCompleted
                      ? 'rgba(16, 185, 129, 0.15)'
                      : isInProgress
                      ? 'rgba(59, 130, 246, 0.2)'
                      : isFailed
                      ? 'rgba(239, 68, 68, 0.2)'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: isCompleted
                      ? '#34d399'
                      : isInProgress
                      ? '#93c5fd'
                      : isFailed
                      ? '#f87171'
                      : '#94a3b8'
                  }}
                >
                  {task.status.replace('_', ' ')}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
