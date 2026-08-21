import React, { useState } from 'react';
import { vscode } from '../../vscode';

interface AskUserModalProps {
  id: string;
  question: string;
  options?: string[];
  defaultOption?: string;
  isMultiSelect?: boolean;
  onClose: () => void;
}

export const AskUserModal: React.FC<AskUserModalProps> = ({
  id,
  question,
  options = [],
  defaultOption,
  isMultiSelect = false,
  onClose
}) => {
  const [selectedOptions, setSelectedOptions] = useState<string[]>(
    defaultOption ? [defaultOption] : options.length > 0 ? [options[0]] : []
  );
  const [customInput, setCustomInput] = useState('');

  const handleToggleOption = (opt: string) => {
    if (isMultiSelect) {
      if (selectedOptions.includes(opt)) {
        setSelectedOptions(selectedOptions.filter((o) => o !== opt));
      } else {
        setSelectedOptions([...selectedOptions, opt]);
      }
    } else {
      setSelectedOptions([opt]);
    }
  };

  const handleSubmit = () => {
    const finalAnswer = customInput.trim()
      ? customInput.trim()
      : selectedOptions.join(', ');

    vscode.postMessage({
      type: 'answerUserPrompt',
      payload: { id, answer: finalAnswer }
    });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
          border: '1px solid var(--vscode-focusBorder, #3b82f6)',
          borderRadius: 12,
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.5)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '20px' }}>🤖</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--vscode-editor-foreground, #f8fafc)' }}>
              Agent Clarification Required
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--vscode-descriptionForeground, #94a3b8)' }}>
              Select an option or provide customized guidance to proceed.
            </p>
          </div>
        </div>

        {/* Question */}
        <div
          style={{
            padding: 12,
            backgroundColor: 'var(--vscode-input-background, rgba(255, 255, 255, 0.04))',
            borderRadius: 8,
            border: '1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.08))',
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--vscode-editor-foreground, #f1f5f9)'
          }}
        >
          {question}
        </div>

        {/* Options List */}
        {options.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
            {options.map((opt, idx) => {
              const isSelected = selectedOptions.includes(opt);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleToggleOption(opt)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '12px',
                    backgroundColor: isSelected
                      ? 'var(--vscode-button-background, #2563eb)'
                      : 'var(--vscode-button-secondaryBackground, rgba(255, 255, 255, 0.05))',
                    color: isSelected
                      ? 'var(--vscode-button-foreground, #ffffff)'
                      : 'var(--vscode-button-secondaryForeground, #e2e8f0)',
                    border: isSelected
                      ? '1px solid var(--vscode-focusBorder, #60a5fa)'
                      : '1px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{opt}</span>
                  {isSelected && <span style={{ fontSize: '12px' }}>✓</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Custom Input (Write-in) */}
        <div>
          <label style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground, #94a3b8)', marginBottom: 4, display: 'block' }}>
            Or type your own custom answer:
          </label>
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Type custom response here..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 10px',
              fontSize: '12px',
              borderRadius: 6,
              backgroundColor: 'var(--vscode-input-background, rgba(0, 0, 0, 0.2))',
              color: 'var(--vscode-input-foreground, #ffffff)',
              border: '1px solid var(--vscode-input-border, rgba(255, 255, 255, 0.15))',
              outline: 'none'
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              borderRadius: 6,
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: 'var(--vscode-descriptionForeground, #94a3b8)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            style={{
              padding: '6px 16px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: 6,
              cursor: 'pointer',
              backgroundColor: 'var(--vscode-button-background, #2563eb)',
              color: 'var(--vscode-button-foreground, #ffffff)',
              border: 'none',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)'
            }}
          >
            Submit Answer
          </button>
        </div>
      </div>
    </div>
  );
};
