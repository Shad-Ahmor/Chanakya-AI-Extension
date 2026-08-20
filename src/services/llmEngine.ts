import * as vscode from 'vscode';
import { ModelConfig } from '../types/config';
import { ContextItem } from '../types/ipc';
import { ConfigManager } from './configManager';
import { Logger } from '../utils/logger';
import { AgentOrchestrator } from './agentOrchestrator';
import { MemoryRetriever } from './memory/MemoryRetriever';
import { TokenOptimizer } from '../utils/tokenOptimizer';
import { ReflectionEngine } from './memory/ReflectionEngine';

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
  onTokensUsed?: (modelId: string, promptTokens: number, completionTokens: number, durationMs?: number, ttftMs?: number, isError?: boolean, originalTokens?: number, optimizedTokens?: number) => void;
  onOptimizationStats?: (originalTokens: number, optimizedTokens: number) => void;
}

/** Simple token estimator: ~4 chars per token (GPT-family heuristic) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * LLMEngine manages multi-provider streaming chat completions, token budgeting,
 * custom headers (workspace-id), and cancellation tokens.
 */
export class LLMEngine {
  private static instance: LLMEngine;
  private readonly logger = Logger.getInstance();
  private readonly configManager = ConfigManager.getInstance();

  public static getInstance(): LLMEngine {
    if (!LLMEngine.instance) {
      LLMEngine.instance = new LLMEngine();
    }
    return LLMEngine.instance;
  }

  /**
   * Streams chat completion for the active configured model.
   */
  public async streamChat(params: {
    prompt: string;
    contextItems: ContextItem[];
    optimizerConfig?: any;
    callbacks: StreamCallbacks;
    cancellationToken?: vscode.CancellationToken;
    existingMessages?: any[];
  }): Promise<void> {
    const { prompt, contextItems, optimizerConfig, callbacks, cancellationToken, existingMessages } = params;
    const config = this.configManager.getConfig();
    const activeModel =
      config.models.find((m) => m.id === config.activeChatModelId) || config.models[0];

    if (!activeModel) {
      callbacks.onError(new Error('No model configured. Please add a model in Model Hub.'));
      return;
    }

    this.logger.log(`Starting stream completion with model "${activeModel.name}" (${activeModel.model})`);

    const abortController = new AbortController();
    if (cancellationToken) {
      cancellationToken.onCancellationRequested(() => {
        this.logger.log('Streaming aborted by user request.');
        abortController.abort();
      });
    }

    const startTime = Date.now();
    let firstChunkTime: number | null = null;
    let isError = false;
    let originalTokens = 0;
    let optimizedTokens = 0;

    const wrappedCallbacks: StreamCallbacks = {
      onChunk: (chunk) => {
        if (!firstChunkTime) firstChunkTime = Date.now();
        callbacks.onChunk(chunk);
      },
      onComplete: (fullText) => {
        callbacks.onComplete(fullText);
      },
      onError: (error) => {
        isError = true;
        callbacks.onError(error);
      },
      onTokensUsed: (modelId, promptTokens, completionTokens) => {
        const endTime = Date.now();
        const durationMs = (endTime - startTime) / 1000;
        const ttftMs = firstChunkTime ? (firstChunkTime - startTime) / 1000 : durationMs;
        
        if (callbacks.onTokensUsed) {
          callbacks.onTokensUsed(modelId, promptTokens, completionTokens, durationMs, ttftMs, isError, originalTokens, optimizedTokens);
        }
      }
    };

    try {
      // 1. Optimize Context Items based on optimizerConfig
      let optimizedContextItems = contextItems.map(item => {
        originalTokens += estimateTokens(item.content);
        
        let content = item.content;
        if (optimizerConfig) {
          if (optimizerConfig.skipComments) {
            content = content.replace(/\/\/.*$/gm, '');
            content = content.replace(/#.*$/gm, ''); // Python style
          }
          if (optimizerConfig.skipDocstrings) {
            content = content.replace(/\/\*[\s\S]*?\*\//g, '');
            content = content.replace(/"""[\s\S]*?"""/g, ''); // Python style
          }
          if (optimizerConfig.skipImports) {
            content = content.replace(/^(import|require|from)\s+.*$/gm, '');
          }
          if (optimizerConfig.removeEmptyLines) {
            content = content.replace(/^\s*[\r\n]/gm, '');
          }
          if (optimizerConfig.removeConsoleLogs) {
            content = content.replace(/console\.(log|info|debug|warn|error|trace).*$/gm, '');
            content = content.replace(/print\(.*$/gm, ''); // Python
          }
        }
        
        const optimizedContent = content.trim();
        optimizedTokens += estimateTokens(optimizedContent);
        return { ...item, content: optimizedContent };
      });

      if (callbacks.onOptimizationStats && originalTokens > 0) {
        callbacks.onOptimizationStats(originalTokens, optimizedTokens);
      }

      if (activeModel.provider === 'gemini' && !activeModel.apiBase?.includes('/v1')) {
        await this.streamGemini(activeModel, prompt, optimizedContextItems, optimizerConfig, wrappedCallbacks, abortController.signal, existingMessages);
      } else {
        // OpenAI-compatible / Ollama / LM Studio / Enterprise AI Foundry
        await this.streamOpenAICompatible(activeModel, prompt, optimizedContextItems, optimizerConfig, wrappedCallbacks, abortController.signal, existingMessages);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.log('Request aborted successfully.');
        return;
      }
      isError = true;
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error('Error during LLM streaming completion', error);
      wrappedCallbacks.onError(error);
      
      // If error happens before tokens are counted, we might still want to log an error request.
      // Usually the provider might not call onTokensUsed if it fails early. 
      // We can manually trigger it here if it hasn't been triggered. (Simplified for now).
    }
  }

  /**
   * OpenAI / Ollama / Enterprise AI Foundry stream completions handler.
   */
  private async streamOpenAICompatible(
    model: ModelConfig,
    prompt: string,
    contextItems: ContextItem[],
    optimizerConfig: any,
    callbacks: StreamCallbacks,
    signal: AbortSignal,
    existingMessages?: any[]
  ): Promise<void> {
    if (signal?.aborted) {
      this.logger.warn('Generation aborted before starting streamOpenAICompatible.');
      return;
    }

    const apiBase = (model.apiBase || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const endpoint = `${apiBase}/chat/completions`;
    const orchestrator = AgentOrchestrator.getInstance();
    let useXmlTools = model.isLocal || ['vllm', 'ollama', 'lmstudio', 'custom'].includes(model.provider);

    let systemContent =
      'You are Chanakya AI, an elite Staff-Level Software Engineer (SDE 4/5) and technical partner. ' +
      'Communicate conversationally, like a highly experienced peer pair-programming with the user.\n' +
      'You have access to tools to run terminal commands, read files, and write code.\n' +
      'CRITICAL RULES:\n' +
      '1. NEVER hallucinate imports or function names. ALWAYS use the `search_code` tool to verify exact names before importing or calling them.\n' +
      '2. If you need to install dependencies (e.g. Django, pip, npm), write a `requirements.txt` or `package.json` first, then run the terminal command.\n' +
      '3. `run_terminal_command` is SYNCHRONOUS. It will wait up to 15 seconds to return output. If you run `pip install`, it will return the success/failure output. You MUST wait for it to succeed before running subsequent commands like `migrate`.\n' +
      '4. ALWAYS prefer `replace_in_file` over `edit_file` when modifying existing files to prevent accidental deletion of code. Only use `edit_file` if you need to rewrite the ENTIRE file from scratch.\n' +
      '5. PROACTIVE RECOMMENDATIONS: When faced with design choices or implementations, propose 2-3 high-level recommendations with pros/cons and ask the user to select one (just like Antigravity does). Do not just blindly code sub-optimal solutions.';

    if (useXmlTools) {
      systemContent += '\n\n' + await orchestrator.getXMLToolInstructions();
    }

    if (optimizerConfig) {
      if (optimizerConfig.responseConciseness === 'ultra_concise') {
        systemContent += ' Provide ONLY code, absolutely no explanations or conversational fluff. ALWAYS wrap code in markdown code blocks (```language).';
      } else if (optimizerConfig.responseConciseness === 'concise') {
        systemContent += ' Keep explanations extremely short and to the point.';
      }
      
      if (optimizerConfig.rules && optimizerConfig.rules.length > 0) {
        systemContent += '\n\nCoding Rules to Strictly Follow:\n' + optimizerConfig.rules.map((r: string) => '- ' + r).join('\n');
      }

      if (optimizerConfig.negativePrompts && optimizerConfig.negativePrompts.length > 0) {
        systemContent += '\n\nNegative Constraints (DO NOT DO THESE):\n' + optimizerConfig.negativePrompts.map((r: string) => '- ' + r).join('\n');
      }

      if (optimizerConfig.programmingLanguages && optimizerConfig.programmingLanguages.length > 0) {
        systemContent += `\n\nTarget Languages/Ecosystems: ${optimizerConfig.programmingLanguages.join(', ')}. Do not provide solutions outside these.`;
      }

      if (optimizerConfig.taskType) {
        systemContent += `\n\n[Task Context] Type: ${optimizerConfig.taskType.toUpperCase()}`;
        if (optimizerConfig.taskType === 'coding' && optimizerConfig.platformTarget && optimizerConfig.platformTarget.length > 0) {
          systemContent += ` | Target Platform(s): ${optimizerConfig.platformTarget.join(', ')}`;
        }
        systemContent += '\nStrictly adapt your reasoning and output format for this specific task type and target context.';
      }
    }

    let formattedUserPrompt = '';
    if (contextItems.length > 0) {
      formattedUserPrompt += '--- Context Items Attached ---\n\n';
      for (const item of contextItems) {
        if (item.type === 'selection') {
          formattedUserPrompt += `[Code Selection: ${item.name}]\n\`\`\`\n${item.content}\n\`\`\`\n\n`;
        } else if (item.type === 'file') {
          formattedUserPrompt += `[File Reference: ${item.name} (${item.path || ''})]\n\`\`\`\n${item.content}\n\`\`\`\n\n`;
        }
      }
      formattedUserPrompt += '--- End of Context ---\n\n';
    }
    formattedUserPrompt += prompt;

    // Retrieve and Inject RAG Memories
    try {
      const memoryRetriever = MemoryRetriever.getInstance();
      const memories = await memoryRetriever.retrieve(prompt, 3);
      if (memories.length > 0) {
        const memoryPrompt = memoryRetriever.formatMemoriesForPrompt(memories);
        systemContent += memoryPrompt;
        callbacks.onChunk(`> 🧠 **Agent Memory Activated:** Retrieved ${memories.length} relevant past experiences.\n\n`);
      }
    } catch (err) {
      this.logger.error('Failed to inject memory RAG', err);
    }

    let messages: any[] = [{ role: 'system', content: systemContent }];
    
    if (existingMessages && existingMessages.length > 0) {
      // Transform existing messages into standard format
      const history = existingMessages
        .filter(m => m.role !== 'system')
        .map(m => {
          const formatted: any = { role: m.role, content: m.content };
          if (m.tool_calls) formatted.tool_calls = m.tool_calls;
          if (m.tool_call_id) formatted.tool_call_id = m.tool_call_id;
          if (m.name) formatted.name = m.name;
          return formatted;
        });
      
      messages.push(...history);
    }
    
    messages.push({ role: 'user', content: formattedUserPrompt });

    // Enforce a strict max token limit for the entire conversation payload
    // Leaving buffer for max completion tokens. e.g. for a 128k context model, we can safely use 16k for prompt history.
    // We'll enforce an aggressive 8000 tokens maximum to reduce latency and costs.
    messages = TokenOptimizer.trimMessages(messages, 8000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(model.requestOptions?.headers || {})
    };

    if (model.apiKey && model.apiKey.trim().length > 0) {
      headers['Authorization'] = `Bearer ${model.apiKey.trim()}`;
    }

    const payload: Record<string, unknown> = {
      model: model.model,
      messages,
      stream: true,
      temperature: model.defaultCompletionOptions?.temperature ?? 0.2,
      max_tokens: model.defaultCompletionOptions?.maxTokens ?? 4096,
      ...(model.requestOptions?.extraBody || {})
    };

    if (!useXmlTools) {
      payload.tools = await orchestrator.getAvailableTools();
    }

    let res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal
    });



    if (!res.ok) {
      const errBody = await res.text();
      if (res.status === 400 && errBody.includes('--enable-auto-tool-choice')) {
        this.logger.log('Local LLM does not support auto tool choice without flags. Switching to XML Tool Parser.');
        delete payload.tools;
        useXmlTools = true; // Dynamically switch to XML parsing
        
        // Inject XML instructions into the system prompt for the retry
        if (messages && messages.length > 0 && messages[0].role === 'system') {
          messages[0].content += '\n\n' + await orchestrator.getXMLToolInstructions();
        }
        
        res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal
        });

        if (!res.ok) {
          const retryErrBody = await res.text();
          throw new Error(`LLM API Error [${res.status}] (Retry without tools): ${retryErrBody}`);
        }
      } else {
        throw new Error(`LLM API Error [${res.status}]: ${errBody}`);
      }
    }

    if (!res.body) {
      throw new Error('Readable stream not supported or response body is empty');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';
    let toolCalls: any[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.substring(6));
          const delta = json.choices?.[0]?.delta;
          
          if (delta?.content) {
            fullText += delta.content;
            callbacks.onChunk(delta.content);
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCalls[tc.index]) {
                  toolCalls[tc.index] = {
                    id: tc.id,
                    type: 'function',
                    function: { name: tc.function?.name || '', arguments: '' }
                  };
                  // Notify UI that a tool is starting
                  if (tc.function?.name) {
                    callbacks.onChunk(`\n> ⚙️ **Running Tool:** \`${tc.function.name}\`...\n`);
                  }
                }
                if (tc.function?.arguments) {
                  toolCalls[tc.index].function.arguments += tc.function.arguments;
                }
              }
            }
          }
        } catch {
          // Incomplete chunk handled in next read
        }
      }
    }

    // Clean up empty items if array has holes
    toolCalls = toolCalls.filter(Boolean);

    // Parse XML tool calls for local models
    if (useXmlTools) {
      const xmlMatch = fullText.match(/<tool_call>([\s\S]*?)<\/tool_call>/);
      if (xmlMatch && xmlMatch[1]) {
        try {
          const parsed = JSON.parse(xmlMatch[1].trim());
          if (parsed.name && parsed.arguments) {
            toolCalls.push({
              id: 'call_' + Math.random().toString(36).substring(2, 9),
              type: 'function',
              function: { name: parsed.name, arguments: JSON.stringify(parsed.arguments) }
            });
            callbacks.onChunk(`\n> ⚙️ **Running XML Tool:** \`${parsed.name}\`...\n`);
          }
        } catch (e) {
          this.logger.error('Failed to parse XML tool call', e);
        }
      }
    }

    // If tool calls were made, execute them and recurse
    if (toolCalls.length > 0) {
      if (!useXmlTools) {
        messages.push({
          role: 'assistant',
          content: fullText || null,
          tool_calls: toolCalls
        });
      } else {
        messages.push({
          role: 'assistant',
          content: fullText || null
        });
      }

      for (const toolCall of toolCalls) {
        if (signal?.aborted) {
          this.logger.warn('Generation aborted by user during tool execution.');
          return;
        }

        try {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await orchestrator.executeTool(toolCall.function.name, args);
          
          if (!useXmlTools) {
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: result
            });
          } else {
            messages.push({
              role: 'user',
              content: `Tool '${toolCall.function.name}' executed successfully.\nResult:\n${result}`
            });
          }
          
          callbacks.onChunk(`> ✅ **Tool Result:** \`${result.substring(0, 100).replace(/\n/g, ' ')}...\`\n\n`);
        } catch (err: any) {
          if (!useXmlTools) {
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: `Error: ${err.message}`
            });
          } else {
            messages.push({
              role: 'user',
              content: `Tool '${toolCall.function.name}' failed with error:\n${err.message}`
            });
          }
          callbacks.onChunk(`> ❌ **Tool Error:** ${err.message}\n\n`);
        }
      }

      if (signal?.aborted) {
        this.logger.warn('Generation aborted by user before recursive call.');
        return;
      }
      // Recursive call for the model to process the tool results
      return this.streamOpenAICompatible(model, prompt, contextItems, optimizerConfig, callbacks, signal, messages);
    } else {
      // Finished
      callbacks.onComplete(fullText);

      // Post-task Memory Reflection (only if it wasn't a tiny conversational prompt)
      if (!existingMessages && prompt.length > 20) {
        ReflectionEngine.getInstance().evaluateTask(prompt, true, fullText).catch(e => this.logger.error(e));
      }

      // Token usage tracking (approximation, doesn't count tool results perfectly yet)
      if (callbacks.onTokensUsed) {
        const promptText = messages.map((m) => m.content).join(' ');
        const promptTokens = estimateTokens(promptText);
        const completionTokens = estimateTokens(fullText);
        const modelId = model.id || model.name;
        callbacks.onTokensUsed(modelId, promptTokens, completionTokens);
      }
    }
  }

  /**
   * Google Gemini Native API Streaming handler.
   */
  private async streamGemini(
    model: ModelConfig,
    prompt: string,
    contextItems: ContextItem[],
    optimizerConfig: any,
    callbacks: StreamCallbacks,
    signal: AbortSignal,
    existingMessages?: any[]
  ): Promise<void> {
    const apiKey = model.apiKey || '';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    let fullPrompt = '';
    if (contextItems.length > 0) {
      for (const item of contextItems) {
        fullPrompt += `[Context: ${item.name}]\n${item.content}\n\n`;
      }
    }
    fullPrompt += prompt;

    // Retrieve and Inject RAG Memories
    try {
      const memoryRetriever = MemoryRetriever.getInstance();
      const memories = await memoryRetriever.retrieve(prompt, 3);
      if (memories.length > 0) {
        fullPrompt = memoryRetriever.formatMemoriesForPrompt(memories) + '\n\n' + fullPrompt;
        callbacks.onChunk(`> 🧠 **Agent Memory Activated:** Retrieved ${memories.length} relevant past experiences.\n\n`);
      }
    } catch (err) {
      this.logger.error('Failed to inject memory RAG', err);
    }

    let contents: any[] = [];
    if (existingMessages && existingMessages.length > 0) {
      // Limit history to the last 6 messages to prevent token explosion
      const recentHistory = existingMessages.slice(-6);
      contents = recentHistory
        .filter(m => m.role !== 'system') // Gemini doesn't mix system in contents
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));
    }
    
    contents.push({ role: 'user', parts: [{ text: fullPrompt }] });

    let systemInstruction = 'You are Chanakya AI, an elite Staff-Level Software Engineer (SDE 4/5) and technical partner. ' +
      'Communicate conversationally, like a highly experienced peer pair-programming with the user.\n' +
      'CRITICAL RULES:\n' +
      '1. NEVER hallucinate imports or function names. ALWAYS use the `search_code` tool to verify exact names before importing or calling them.\n' +
      '2. If you need to install dependencies (e.g. Django, pip, npm), write a `requirements.txt` or `package.json` first, then run the terminal command.\n' +
      '3. `run_terminal_command` executes in the VS Code Integrated Terminal visually for the user. Do not wait for long processes like dev servers to finish; just start them.\n' +
      '4. Provide clean, efficient, and well-documented code.\n' +
      '5. PROACTIVE RECOMMENDATIONS: When faced with design choices or implementations, propose 2-3 high-level recommendations with pros/cons and ask the user to select one (just like Antigravity does). Do not just blindly code sub-optimal solutions.';
    if (optimizerConfig) {
      if (optimizerConfig.responseConciseness === 'ultra_concise') {
        systemInstruction += ' Provide ONLY code, absolutely no explanations or conversational fluff. ALWAYS wrap code in markdown code blocks (```language).';
      } else if (optimizerConfig.responseConciseness === 'concise') {
        systemInstruction += ' Keep explanations extremely short and to the point.';
      }
      if (optimizerConfig.rules && optimizerConfig.rules.length > 0) {
        systemInstruction += '\n\nCoding Rules to Strictly Follow:\n' + optimizerConfig.rules.map((r: string) => '- ' + r).join('\n');
      }
      if (optimizerConfig.negativePrompts && optimizerConfig.negativePrompts.length > 0) {
        systemInstruction += '\n\nNegative Constraints (DO NOT DO THESE):\n' + optimizerConfig.negativePrompts.map((r: string) => '- ' + r).join('\n');
      }
      if (optimizerConfig.programmingLanguages && optimizerConfig.programmingLanguages.length > 0) {
        systemInstruction += `\n\nTarget Languages/Ecosystems: ${optimizerConfig.programmingLanguages.join(', ')}. Do not provide solutions outside these.`;
      }
      if (optimizerConfig.taskType) {
        systemInstruction += `\n\n[Task Context] Type: ${optimizerConfig.taskType.toUpperCase()}`;
        if (optimizerConfig.taskType === 'coding' && optimizerConfig.platformTarget && optimizerConfig.platformTarget.length > 0) {
          systemInstruction += ` | Target Platform(s): ${optimizerConfig.platformTarget.join(', ')}`;
        }
        systemInstruction += '\nStrictly adapt your reasoning and output format for this specific task type and target context.';
      }
    }

    const bodyPayload: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: model.defaultCompletionOptions?.temperature ?? 0.2,
        maxOutputTokens: model.defaultCompletionOptions?.maxTokens ?? 4096,
        topP: 0.95
      },
      systemInstruction: { parts: [{ text: systemInstruction }] }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API Error [${res.status}]: ${err}`);
    }

    if (!res.body) throw new Error('Response body empty');

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        try {
          const json = JSON.parse(trimmed.substring(6));
          const partText = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (partText) {
            fullText += partText;
            callbacks.onChunk(partText);
          }
        } catch {
          // Next buffer
        }
      }
    }

    callbacks.onComplete(fullText);

    // Post-task Memory Reflection
    if (prompt.length > 20) {
      ReflectionEngine.getInstance().evaluateTask(prompt, true, fullText).catch(e => this.logger.error(e));
    }

    // Token usage tracking
    if (callbacks.onTokensUsed) {
      const promptText = fullPrompt;
      const promptTokens = estimateTokens(promptText);
      const completionTokens = estimateTokens(fullText);
      const modelId = model.id || model.name;
      callbacks.onTokensUsed(modelId, promptTokens, completionTokens);
    }
  }
}
