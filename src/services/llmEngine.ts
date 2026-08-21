import * as vscode from 'vscode';
import { ModelConfig } from '../types/config';
import { ContextItem } from '../types/ipc';
import { ConfigManager } from './configManager';
import { Logger } from '../utils/logger';
import { AgentOrchestrator } from './agentOrchestrator';
import { TrajectoryRecorder } from './skillOpt/trajectoryRecorder';
import { EvaluatorFactory } from './skillOpt/evaluator';
import { MemoryRetriever } from './memory/MemoryRetriever';
import { TokenOptimizer } from '../utils/tokenOptimizer';
import { ReflectionEngine } from './memory/ReflectionEngine';
import { UnifiedContextBuilder } from './unifiedContextBuilder';

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string, newMessages?: any[]) => void;
  onError: (error: Error) => void;
  onThoughtChunk?: (chunk: string) => void;
  onThoughtComplete?: (thought: string, durationMs: number) => void;
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
      config.models.find((m) => m.id === config.activeChatModelId || m.name === config.activeChatModelId) || config.models[0];

    if (!activeModel) {
      callbacks.onError(new Error('No model configured. Please add a model in Model Hub.'));
      return;
    }

    const taskId = 'task-' + Date.now().toString() + '-' + Math.floor(Math.random() * 1000).toString();
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspaceRoot = workspaceFolders ? workspaceFolders[0].uri.fsPath : '';

    let activeSkill = 'multi';
    let bestVersion = 1;

    // Rules and SkillOps are now handled by UnifiedContextBuilder

    const recorder = TrajectoryRecorder.getInstance(workspaceRoot);
    recorder.startTask(taskId, prompt, activeSkill, bestVersion);

    this.logger.log(`Starting stream completion with model "${activeModel.name}" (${activeModel.model}) [Task: ${taskId}]`);

    const abortController = new AbortController();
    if (cancellationToken) {
      cancellationToken.onCancellationRequested(() => {
        this.logger.log('Streaming aborted by user request.');
        recorder.endTask(taskId, false);
        abortController.abort();
      });
    }

    const startTime = Date.now();
    let firstChunkTime: number | null = null;
    let isError = false;
    let originalTokens = 0;
    let optimizedTokens = 0;
    let isInsideThink = false;
    let thoughtBuffer = '';
    let thoughtStartTime: number | null = null;
    let thoughtDurationMs = 0;

    const wrappedCallbacks: StreamCallbacks = {
      onChunk: (chunk) => {
        if (!firstChunkTime) firstChunkTime = Date.now();

        if (!isInsideThink && chunk.includes('<think>')) {
          isInsideThink = true;
          thoughtStartTime = Date.now();
          const parts = chunk.split('<think>');
          if (parts[0]) callbacks.onChunk(parts[0]);
          const remainder = parts.slice(1).join('<think>');
          if (remainder.includes('</think>')) {
            const tParts = remainder.split('</think>');
            thoughtBuffer += tParts[0];
            thoughtDurationMs = Date.now() - (thoughtStartTime || startTime);
            if (callbacks.onThoughtChunk) callbacks.onThoughtChunk(tParts[0]);
            if (callbacks.onThoughtComplete) callbacks.onThoughtComplete(thoughtBuffer, thoughtDurationMs);
            isInsideThink = false;
            if (tParts[1]) callbacks.onChunk(tParts[1]);
          } else {
            thoughtBuffer += remainder;
            if (callbacks.onThoughtChunk) callbacks.onThoughtChunk(remainder);
          }
          return;
        }

        if (isInsideThink) {
          if (chunk.includes('</think>')) {
            const parts = chunk.split('</think>');
            thoughtBuffer += parts[0];
            thoughtDurationMs = Date.now() - (thoughtStartTime || startTime);
            if (callbacks.onThoughtChunk) callbacks.onThoughtChunk(parts[0]);
            if (callbacks.onThoughtComplete) callbacks.onThoughtComplete(thoughtBuffer, thoughtDurationMs);
            isInsideThink = false;
            if (parts[1]) callbacks.onChunk(parts[1]);
          } else {
            thoughtBuffer += chunk;
            if (callbacks.onThoughtChunk) callbacks.onThoughtChunk(chunk);
          }
          return;
        }

        callbacks.onChunk(chunk);
      },
      onComplete: (fullText) => {
        // Clean out any raw <think> tags from final text if lingering
        const cleanText = fullText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        try {
          recorder.endTask(taskId, true);
          const trajectory = recorder.getTrajectory(taskId);
          if (trajectory) {
             const evaluator = EvaluatorFactory.getEvaluator();
             const result = evaluator.evaluate(trajectory);
             this.logger.log(`SkillOps [Task ${taskId}] evaluated: Score ${result.score}, Success: ${result.success}. Reason: ${result.reason}`);
          }
        } catch (e) {
          this.logger.warn('SkillOps evaluation failed, ignoring: ' + e);
        }
        callbacks.onComplete(cleanText || fullText);
      },
      onError: (error) => {
        try {
          recorder.endTask(taskId, false);
          const trajectory = recorder.getTrajectory(taskId);
          if (trajectory) {
             const evaluator = EvaluatorFactory.getEvaluator();
             const result = evaluator.evaluate(trajectory);
             this.logger.log(`SkillOps [Task ${taskId}] evaluated on error: Score ${result.score}, Success: ${result.success}`);
          }
        } catch (e) {
          this.logger.warn('SkillOps error evaluation failed, ignoring: ' + e);
        }
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

      // Sliding Window & Token Limiter Logic
      const MAX_TOKENS = activeModel.defaultCompletionOptions?.contextLength || 8192;
      let promptTokens = estimateTokens(prompt);
      let messagesTokens = estimateTokens(JSON.stringify(existingMessages || []));
      let contextItemsTokens = optimizedTokens;
      
      let totalTokens = promptTokens + messagesTokens + contextItemsTokens;
      let finalMessages = existingMessages ? [...existingMessages] : [];

      // If we exceed max tokens, try pruning older conversation messages first
      while (totalTokens > MAX_TOKENS * 0.9 && finalMessages.length > 2) {
        // Remove the oldest message (index 0 is usually system prompt if it exists, but let's just shift)
        finalMessages.shift();
        messagesTokens = estimateTokens(JSON.stringify(finalMessages));
        totalTokens = promptTokens + messagesTokens + contextItemsTokens;
        this.logger.log(`[TokenOptimizer] Pruned old message. New total tokens: ${totalTokens}`);
      }

      // If STILL too big even after removing all history except latest
      if (totalTokens > MAX_TOKENS) {
         throw new Error(`Token Limit Exceeded! Your prompt and attachments (${totalTokens} tokens) exceed the model's maximum context length of ${MAX_TOKENS} tokens. Please try clearing the chat or attaching smaller files.`);
      }

      if (activeModel.provider === 'gemini' && !activeModel.apiBase?.includes('/v1')) {
        await this.streamGemini(activeModel, prompt, optimizedContextItems, optimizerConfig, wrappedCallbacks, abortController.signal, finalMessages);
      } else {
        // OpenAI-compatible / Ollama / LM Studio / Enterprise AI Foundry
        await this.streamOpenAICompatible(activeModel, prompt, optimizedContextItems, optimizerConfig, wrappedCallbacks, abortController.signal, finalMessages, taskId, recorder);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.log('Request aborted successfully.');
        return;
      }
      isError = true;
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error('Error during LLM streaming completion', error);
      recorder.endTask(taskId, false);
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
    existingMessages?: any[],
    taskId?: string,
    recorder?: TrajectoryRecorder,
    accumulatedNewMessages: any[] = []
  ): Promise<void> {
    if (signal?.aborted) {
      this.logger.warn('Generation aborted before starting streamOpenAICompatible.');
      if (taskId && recorder) recorder.endTask(taskId, false);
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
      (vscode.workspace.workspaceFolders?.length ? `[WORKSPACE ROOT]: ${vscode.workspace.workspaceFolders[0].uri.fsPath}\nUse this path as the base for all file operations.\n` : '') +
      'CRITICAL RULES:\n' +
      '1. NEVER hallucinate imports or function names. ALWAYS use the `search_code` tool to verify exact names before importing or calling them.\n' +
      '2. If you need to install dependencies (e.g. Django, pip, npm), write a `requirements.txt` or `package.json` first, then run the terminal command.\n' +
      '3. `run_terminal_command` is SYNCHRONOUS. It will wait up to 15 seconds to return output. If you run `pip install`, it will return the success/failure output. You MUST wait for it to succeed before running subsequent commands like `migrate`.\n' +
      '4. ALWAYS prefer `replace_in_file` over `edit_file` when modifying existing files to prevent accidental deletion of code. Only use `edit_file` if you need to rewrite the ENTIRE file from scratch.\n' +
      '5. When scaffolding full projects or creating multiple files, use the `create_file` tool one by one. The system will automatically execute it and return the result to you so you can iteratively call the next tool until the project is complete.\n' +
      '6. PROACTIVE RECOMMENDATIONS: When faced with design choices or implementations, propose 2-3 high-level recommendations with pros/cons and ask the user to select one (just like Antigravity does). Do not just blindly code sub-optimal solutions.\n' +
      '7. PLANNING MODE (For Complex Tasks or Very Long Prompts):\n' +
      'When asked to build a project, do a complex task, OR if the user provides a very long requirements document (e.g., 25-30+ pages), YOU MUST follow this strict workflow:\n' +
      '  Phase 1: DO NOT start coding immediately. Take time to think, optimize, and deeply understand the text. Write an `implementation_plan.md` using `create_file` detailing your approach and architecture. Then STOP and ask the user to type "Proceed" to approve it.\n' +
      '  Phase 2: Once approved, write a `task.md` file (or `plan.md`) using `create_file` containing a checklist of all files to be created/edited/deleted, their paths, and specific actions (e.g. `- [ ] create src/App.tsx - Add main component`).\n' +
      '  Phase 3: Execute the tasks one by one autonomously from the work plan. After completing each file, you MUST use `replace_in_file` to update `task.md` by checking off the completed task (`- [x]`).\n' +
      '  Phase 4: Continue this loop until all tasks are marked `[x]`.';

    if (useXmlTools) {
      if (!optimizerConfig || optimizerConfig.needsMCP !== false) {
        systemContent += '\n\n' + await orchestrator.getXMLToolInstructions();
      }
    }

    if (optimizerConfig) {
      if (optimizerConfig.responseConciseness === 'ultra_concise') {
        systemContent += ' Provide ONLY code, absolutely no explanations or conversational fluff. If you are outputting code to the chat, ALWAYS wrap it in markdown code blocks (```language). Do NOT wrap JSON tool arguments in markdown backticks.';
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

    const contextResult = await UnifiedContextBuilder.getInstance().buildContext({
      prompt: prompt,
      workspaceRoot: vscode.workspace.workspaceFolders?.[0].uri.fsPath || '',
      baseSystemPrompt: systemContent,
      optimizerConfig: optimizerConfig,
      contextItems: contextItems,
      existingMessages: existingMessages || []
    });

    systemContent = contextResult.systemPrompt;
    let formattedUserPrompt = contextResult.userPrompt;
    
    callbacks.onChunk(`> 🧠 **Context Diagnostics:** [Rules: ${contextResult.diagnostics.rulesCount} | Skills: ${contextResult.diagnostics.skillsCount} | RAG Chunks: ${contextResult.diagnostics.ragChunksCount} | MCP Results: ${contextResult.diagnostics.mcpResultsCount}] (Est ${contextResult.diagnostics.estimatedTokens} context tokens)\n\n`);

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
      ...(model.requestOptions?.extraBody || {})
    };

    if (model.defaultCompletionOptions?.maxTokens) {
      payload.max_tokens = model.defaultCompletionOptions.maxTokens;
    }

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
        if (!optimizerConfig || optimizerConfig.needsMCP !== false) {
          messages[0].content += '\n\n' + await orchestrator.getXMLToolInstructions();
        }
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
      const xmlRegex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
      let xmlMatch;
      while ((xmlMatch = xmlRegex.exec(fullText)) !== null) {
        if (xmlMatch && xmlMatch[1]) {
          try {
            // Strip markdown backticks if LLM mistakenly wrapped it
            let jsonString = xmlMatch[1].trim();
            jsonString = jsonString.replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '');
            
            const parsed = JSON.parse(jsonString);
            if (parsed.name && parsed.arguments) {
              toolCalls.push({
                id: 'call_' + Math.random().toString(36).substring(2, 9),
                type: 'function',
                function: { name: parsed.name, arguments: JSON.stringify(parsed.arguments) }
              });
              // Callbacks are suppressed here because the UI (ChatMessageItem) will now render it natively
            }
          } catch (e) {
            this.logger.error('Failed to parse XML tool call', e);
          }
        }
      }
    }

    // If tool calls were made, execute them and recurse
    if (toolCalls.length > 0) {
      if (!useXmlTools) {
        const assistantMsg = {
          role: 'assistant',
          content: fullText || null,
          tool_calls: toolCalls
        };
        messages.push(assistantMsg);
        accumulatedNewMessages.push(assistantMsg);
      } else {
        const assistantMsg = {
          role: 'assistant',
          content: fullText || null
        };
        messages.push(assistantMsg);
        accumulatedNewMessages.push(assistantMsg);
      }

      for (const toolCall of toolCalls) {
        if (signal?.aborted) {
          this.logger.warn('Generation aborted by user during tool execution.');
          return;
        }

        try {
          let cleanArgs = toolCall.function.arguments.trim();
          cleanArgs = cleanArgs.replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '');
          const args = JSON.parse(cleanArgs);
          const result = await orchestrator.executeTool(toolCall.function.name, args);
          
          if (taskId && recorder) {
            recorder.recordToolCall(taskId, toolCall.function.name, args, result);
          }
          
          if (!useXmlTools) {
            const toolMsg = {
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: result
            };
            messages.push(toolMsg);
            accumulatedNewMessages.push(toolMsg);
          } else {
            const toolMsg = {
              role: 'user',
              content: `Tool '${toolCall.function.name}' executed successfully.\nResult:\n${result}`
            };
            messages.push(toolMsg);
            accumulatedNewMessages.push(toolMsg);
          }
        } catch (err: any) {
          this.logger.error(`Error executing tool ${toolCall.function.name}:`, err);
          if (taskId && recorder) {
            recorder.recordToolCall(taskId, toolCall.function.name, toolCall.function.arguments, undefined, err.message);
          }
          if (!useXmlTools) {
            const errorMsg = {
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: `Error: ${err.message}`
            };
            messages.push(errorMsg);
            accumulatedNewMessages.push(errorMsg);
          } else {
            const errorMsg = {
              role: 'user',
              content: `Tool '${toolCall.function.name}' failed with error:\n${err.message}`
            };
            messages.push(errorMsg);
            accumulatedNewMessages.push(errorMsg);
          }
          callbacks.onChunk(`> ❌ **Tool Error:** ${err.message}\n\n`);
        }
      }

      if (signal?.aborted) {
        this.logger.warn('Generation aborted by user before recursive call.');
        return;
      }
      // Recursive call for the model to process the tool results
      return this.streamOpenAICompatible(model, prompt, contextItems, optimizerConfig, callbacks, signal, messages, taskId, recorder, accumulatedNewMessages);
    } else {
      // Finished
      accumulatedNewMessages.push({
        role: 'assistant',
        content: fullText || null
      });
      callbacks.onComplete(fullText, accumulatedNewMessages);

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
    existingMessages?: any[],
    accumulatedNewMessages: any[] = []
  ): Promise<void> {
    const apiKey = model.apiKey || '';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    let systemInstruction = 'You are Chanakya AI, an elite Staff-Level Software Engineer (SDE 4/5) and technical partner. ' +
      'Communicate conversationally, like a highly experienced peer pair-programming with the user.\n' +
      (vscode.workspace.workspaceFolders?.length ? `[WORKSPACE ROOT]: ${vscode.workspace.workspaceFolders[0].uri.fsPath}\nUse this path as the base for all file operations.\n` : '') +
      'CRITICAL RULES:\n' +
      '1. NEVER hallucinate imports or function names. ALWAYS use the `search_code` tool to verify exact names before importing or calling them.\n' +
      '2. If you need to install dependencies (e.g. Django, pip, npm), write a `requirements.txt` or `package.json` first, then run the terminal command.\n' +
      '3. `run_terminal_command` executes in the VS Code Integrated Terminal visually for the user. Do not wait for long processes like dev servers to finish; just start them.\n' +
      '4. Provide clean, efficient, and well-documented code.\n' +
      '5. When scaffolding full projects or creating multiple files, use the `create_file` tool one by one. The system will automatically execute it and return the result to you so you can iteratively call the next tool until the project is complete.\n' +
      '6. PROACTIVE RECOMMENDATIONS: When faced with design choices or implementations, propose 2-3 high-level recommendations with pros/cons and ask the user to select one (just like Antigravity does). Do not just blindly code sub-optimal solutions.\n' +
      '7. PLANNING MODE (For Complex Tasks or Very Long Prompts):\n' +
      'When asked to build a project, do a complex task, OR if the user provides a very long requirements document (e.g., 25-30+ pages), YOU MUST follow this strict workflow:\n' +
      '  Phase 1: DO NOT start coding immediately. Take time to think, optimize, and deeply understand the text. Write an `implementation_plan.md` using `create_file` detailing your approach and architecture. Then STOP and ask the user to type "Proceed" to approve it.\n' +
      '  Phase 2: Once approved, write a `task.md` file (or `plan.md`) using `create_file` containing a checklist of all files to be created/edited/deleted, their paths, and specific actions (e.g. `- [ ] create src/App.tsx - Add main component`).\n' +
      '  Phase 3: Execute the tasks one by one autonomously from the work plan. After completing each file, you MUST use `replace_in_file` to update `task.md` by checking off the completed task (`- [x]`).\n' +
      '  Phase 4: Continue this loop until all tasks are marked `[x]`. If disconnected, you can read `task.md` to resume exactly where you left off.';
      
    if (!optimizerConfig || optimizerConfig.needsMCP !== false) {
      systemInstruction += '\n\n' + await AgentOrchestrator.getInstance().getXMLToolInstructions();
    }

    if (optimizerConfig) {
      if (optimizerConfig.responseConciseness === 'ultra_concise') {
        systemInstruction += ' Provide ONLY code, absolutely no explanations or conversational fluff. If you are outputting code to the chat, ALWAYS wrap it in markdown code blocks (```language). Do NOT wrap JSON tool arguments in markdown backticks.';
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

    const contextResult = await UnifiedContextBuilder.getInstance().buildContext({
      prompt: prompt,
      workspaceRoot: vscode.workspace.workspaceFolders?.[0].uri.fsPath || '',
      baseSystemPrompt: systemInstruction,
      optimizerConfig: optimizerConfig,
      contextItems: contextItems,
      existingMessages: existingMessages || []
    });

    systemInstruction = contextResult.systemPrompt;
    let fullPrompt = contextResult.userPrompt;
    
    callbacks.onChunk(`> 🧠 **Context Diagnostics:** [Rules: ${contextResult.diagnostics.rulesCount} | Skills: ${contextResult.diagnostics.skillsCount} | RAG Chunks: ${contextResult.diagnostics.ragChunksCount} | MCP Results: ${contextResult.diagnostics.mcpResultsCount}] (Est ${contextResult.diagnostics.estimatedTokens} context tokens)\n\n`);

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

    const generationConfig: Record<string, unknown> = {
      temperature: model.defaultCompletionOptions?.temperature ?? 0.2,
      topP: 0.95
    };

    if (model.defaultCompletionOptions?.maxTokens) {
      generationConfig.maxOutputTokens = model.defaultCompletionOptions.maxTokens;
    }

    const bodyPayload: Record<string, unknown> = {
      contents,
      generationConfig,
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

    let toolCalls: any[] = [];
    const xmlRegex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
    let xmlMatch;
    while ((xmlMatch = xmlRegex.exec(fullText)) !== null) {
      if (xmlMatch && xmlMatch[1]) {
        try {
          let jsonString = xmlMatch[1].trim();
          jsonString = jsonString.replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '');
          
          const parsed = JSON.parse(jsonString);
          if (parsed.name && parsed.arguments) {
            toolCalls.push({
              id: 'call_' + Math.random().toString(36).substring(2, 9),
              type: 'function',
              function: { name: parsed.name, arguments: JSON.stringify(parsed.arguments) }
            });
          }
        } catch (e) {
          this.logger.error('Failed to parse XML tool call', e);
        }
      }
    }

    let messages = existingMessages ? [...existingMessages] : [];
    
    if (toolCalls.length > 0) {
      const orchestrator = AgentOrchestrator.getInstance();
      const assistantMsg = { role: 'assistant', content: fullText || null };
      messages.push(assistantMsg);
      accumulatedNewMessages.push(assistantMsg);

      for (const toolCall of toolCalls) {
        if (signal?.aborted) {
          this.logger.warn('Generation aborted by user during tool execution.');
          return;
        }

        try {
          let cleanArgs = toolCall.function.arguments.trim();
          cleanArgs = cleanArgs.replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '');
          const args = JSON.parse(cleanArgs);
          const result = await orchestrator.executeTool(toolCall.function.name, args);
          
          const toolMsg = {
            role: 'user',
            content: `Tool '${toolCall.function.name}' executed successfully.\nResult:\n${result}`
          };
          messages.push(toolMsg);
          accumulatedNewMessages.push(toolMsg);
          callbacks.onChunk(`> ✅ **Tool Result:** \`${result.substring(0, 100).replace(/\n/g, ' ')}...\`\n\n`);
        } catch (err: any) {
          const errorMsg = {
            role: 'user',
            content: `Tool '${toolCall.function.name}' failed with error:\n${err.message}`
          };
          messages.push(errorMsg);
          accumulatedNewMessages.push(errorMsg);
          callbacks.onChunk(`> ❌ **Tool Error:** ${err.message}\n\n`);
        }
      }

      if (signal?.aborted) {
        this.logger.warn('Generation aborted by user before recursive call.');
        return;
      }

      return this.streamGemini(model, prompt, contextItems, optimizerConfig, callbacks, signal, messages, accumulatedNewMessages);
    } else {
      const finalMsg = { role: 'assistant', content: fullText || null };
      accumulatedNewMessages.push(finalMsg);
      callbacks.onComplete(fullText, accumulatedNewMessages);
    }

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
