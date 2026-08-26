// @ts-check
(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  const messagesContainer = document.getElementById('messagesContainer');
  const promptInput = /** @type {HTMLTextAreaElement} */ (document.getElementById('promptInput'));
  const sendBtn = /** @type {HTMLButtonElement} */ (document.getElementById('sendBtn'));
  const statusIndicator = document.getElementById('statusIndicator');
  const activeFileSpan = document.getElementById('activeFile');

  /** @type {Map<string, { element: HTMLElement; rawText: string }>} */
  const activeStreams = new Map();

  // Initialize
  vscode.postMessage({ type: 'ready' });
  vscode.postMessage({ type: 'getApiKeyStatus' });

  // Auto-resize textarea
  promptInput.addEventListener('input', () => {
    promptInput.style.height = 'auto';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + 'px';
  });

  // Handle Enter key (Shift+Enter for newline)
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  sendBtn.addEventListener('click', handleSend);

  // Quick Action Buttons
  document.querySelectorAll('.quick-action-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      if (action) {
        let text = '';
        if (action === 'enhance') text = 'Please enhance and optimize this code.';
        else if (action === 'explain') text = 'Please explain how this code works step-by-step.';
        else if (action === 'refactor') text = 'Refactor this code to follow clean code standards.';
        else if (action === 'docstring') text = 'Add complete JSDoc / Docstrings to this code.';

        vscode.postMessage({
          type: 'sendMessage',
          payload: { text, action, includeSelection: true }
        });
      }
    });
  });

  function handleSend() {
    const text = promptInput.value.trim();
    if (!text) return;

    promptInput.value = '';
    promptInput.style.height = '40px';

    vscode.postMessage({
      type: 'sendMessage',
      payload: { text, includeSelection: true }
    });
  }

  // Handle incoming messages from Extension Host
  window.addEventListener('message', (event) => {
    const message = event.data;

    switch (message.type) {
      case 'setApiKeyStatus': {
        const { hasKey } = message.payload;
        if (statusIndicator) {
          if (hasKey) {
            statusIndicator.classList.add('ready');
            statusIndicator.title = 'Chanakya AI Agent is connected & ready';
          } else {
            statusIndicator.classList.remove('ready');
            statusIndicator.title = 'API Key missing. Click settings to configure.';
          }
        }
        break;
      }

      case 'updateContext': {
        const { activeFile } = message.payload;
        if (activeFileSpan) {
          activeFileSpan.textContent = activeFile ? `Active: ${activeFile}` : 'No active file';
        }
        break;
      }

      case 'addMessage': {
        appendMessage(message.payload);
        break;
      }

      case 'streamChunk': {
        const { id, chunk } = message.payload;
        handleStreamChunk(id, chunk);
        break;
      }

      case 'streamEnd': {
        const { id } = message.payload;
        finalizeStream(id);
        break;
      }

      case 'clearChat': {
        if (messagesContainer) {
          messagesContainer.innerHTML = '';
          renderWelcomeBanner();
        }
        break;
      }

      case 'setLoading': {
        sendBtn.disabled = message.payload.isLoading;
        break;
      }

      case 'setError': {
        appendSystemMessage(`⚠️ ${message.payload.message}`);
        break;
      }
    }
  });

  function appendMessage(msg) {
    if (!messagesContainer) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${msg.sender}`;
    msgDiv.id = `msg-${msg.id}`;

    if (msg.sender === 'assistant' && msg.isStreaming) {
      activeStreams.set(msg.id, { element: msgDiv, rawText: '' });
      msgDiv.innerHTML = `<span class="stream-content"></span><span class="typing-cursor"></span>`;
    } else {
      msgDiv.innerHTML = renderMarkdown(msg.text);
      attachCodeBlockListeners(msgDiv);
    }

    messagesContainer.appendChild(msgDiv);
    scrollToBottom();
  }

  function handleStreamChunk(id, chunk) {
    const stream = activeStreams.get(id);
    if (!stream) return;

    stream.rawText += chunk;
    const contentSpan = stream.element.querySelector('.stream-content');
    if (contentSpan) {
      contentSpan.innerHTML = renderMarkdown(stream.rawText);
      attachCodeBlockListeners(stream.element);
    }
    scrollToBottom();
  }

  function finalizeStream(id) {
    const stream = activeStreams.get(id);
    if (!stream) return;

    const cursor = stream.element.querySelector('.typing-cursor');
    if (cursor) cursor.remove();

    stream.element.innerHTML = renderMarkdown(stream.rawText);
    attachCodeBlockListeners(stream.element);
    activeStreams.delete(id);
    scrollToBottom();
  }

  function appendSystemMessage(text) {
    if (!messagesContainer) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message system';
    msgDiv.textContent = text;
    messagesContainer.appendChild(msgDiv);
    scrollToBottom();
  }

  function renderWelcomeBanner() {
    if (!messagesContainer) return;
    const banner = document.createElement('div');
    banner.className = 'chat-message assistant';
    banner.innerHTML = `
      <strong>✨ Welcome to Chanakya AI Agent</strong><br/>
      Select code in your editor and ask questions, generate enhancements, refactor, or click the quick action chips above.
    `;
    messagesContainer.appendChild(banner);
  }

  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  // Safe markdown renderer for code blocks and basic formatting
  function renderMarkdown(text) {
    if (!text) return '';

    // Simple code block parser
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    let formatted = text.replace(codeBlockRegex, (match, lang, code) => {
      const language = lang || 'code';
      const escapedCode = escapeHtml(code.trim());
      const rawCodeEncoded = encodeURIComponent(code);

      return `
        <div class="code-block-wrapper">
          <div class="code-block-header">
            <span>${language}</span>
            <div class="code-actions">
              <button class="code-btn copy-btn" data-code="${rawCodeEncoded}">📋 Copy</button>
              <button class="code-btn insert-btn" data-code="${rawCodeEncoded}">📥 Insert</button>
            </div>
          </div>
          <pre><code>${escapedCode}</code></pre>
        </div>
      `;
    });

    // Inline code `code`
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold **text**
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Line breaks (except inside pre)
    return formatted.replace(/\n(?![^<]*<\/pre>)/g, '<br/>');
  }

  function attachCodeBlockListeners(container) {
    container.querySelectorAll('.copy-btn').forEach((btn) => {
      btn.onclick = () => {
        const rawCode = decodeURIComponent(btn.getAttribute('data-code') || '');
        vscode.postMessage({ type: 'copyToClipboard', payload: { text: rawCode } });
        btn.textContent = '✅ Copied';
        setTimeout(() => {
          btn.textContent = '📋 Copy';
        }, 1500);
      };
    });

    container.querySelectorAll('.insert-btn').forEach((btn) => {
      btn.onclick = () => {
        const rawCode = decodeURIComponent(btn.getAttribute('data-code') || '');
        vscode.postMessage({ type: 'insertCode', payload: { code: rawCode } });
      };
    });
  }

  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  renderWelcomeBanner();
})();
