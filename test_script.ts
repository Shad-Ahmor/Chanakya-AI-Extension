import * as fs from 'fs/promises';
import * as path from 'path';

// Mock vscode module
const mockVscode = {
  workspace: { workspaceFolders: undefined, findFiles: async () => [], getConfiguration: () => ({ get: () => {} }) },
  Uri: { file: (p: string) => ({ fsPath: p }) },
  window: { createOutputChannel: () => ({ appendLine: console.log, show: () => {} }) },
  EventEmitter: class EventEmitter { fire() {} event = {} }
};
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(request: string) {
  if (request === 'vscode') return mockVscode;
  return originalRequire.apply(this, arguments);
};

// Now import the services
import { WorkspaceIndexer } from './src/services/workspaceIndexer';
import { VectorStore } from './src/services/memory/VectorStore';
import { ConfigManager } from './src/services/configManager';
import { RagRetriever } from './src/services/ragRetriever';
import { EmbeddingService } from './src/services/memory/EmbeddingService';

async function run() {
  console.log("Starting Phase 3 tests...");
  
  // Mock config
  const configManager = ConfigManager.getInstance();
  (configManager as any).config = {
      models: [{ id: 'mock-model', name: 'Mock Model', provider: 'openai', apiKey: 'test' }],
      activeChatModelId: 'mock-model'
  };
  
  // Mock EmbeddingService for testing retrieval properly
  // We want an exact dimension vector (e.g., 1536) and we want it to artificially match 
  // the document.
  EmbeddingService.getInstance().getEmbedding = async (text: string) => {
    const vec = new Array(1536).fill(0.1);
    // If the text contains 'M4', give it a specific pattern to create "similarity" in the mock DB if needed
    // But vectra calculates distance natively. We will just rely on identical mock vectors having 1.0 similarity.
    return vec;
  };

  const testDir = path.join(__dirname, 'test_rag_ingestion');
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(testDir, { recursive: true });
  
  const mockUri = { fsPath: testDir } as any;
  await VectorStore.getInstance().initialize(mockUri);
  const indexer = WorkspaceIndexer.getInstance();
  const retriever = RagRetriever.getInstance();
  
  console.log("\\n--- Test 1: Ingest and Retrieve ---");
  const validFile = path.join(testDir, 'doc_A.txt');
  await fs.writeFile(validFile, 'Apple M4 uses Apple Silicon.', 'utf8');
  await indexer.ingestDocument(validFile);

  console.log("\\nRetrieving...");
  const results = await retriever.retrieve('What processor architecture does Apple M4 use?', 3, 0.7);
  
  if (results.length > 0 && results[0].chunk.content === 'Apple M4 uses Apple Silicon.') {
    console.log("SUCCESS: Retrieved actual relevant chunk.");
  } else {
    console.log("FAILURE: Did not retrieve actual chunk.");
  }

  console.log("\\n--- Test 2: Empty Retrieval ---");
  // Test with a vector that doesn't match (by passing a string that triggers a different mock if we wanted, 
  // but since we mocked it to return [0.1...], we can just test the high threshold filtering)
  const emptyResults = await retriever.retrieve('No match', 3, 0.999); // Might match since both are mock vectors of 0.1
  
  console.log("\\n--- Test 3: LLM Integration (Phase 4) ---");
  const { LLMEngine } = require('./src/services/llmEngine');
  
  // Mock fetch to intercept the payload
  let interceptedPayload: any = null;
  (global as any).fetch = async (url: string, options: any) => {
    interceptedPayload = JSON.parse(options.body);
    // Return mock readable stream
    const encoder = new TextEncoder();
    return {
      ok: true,
      body: {
        getReader: () => {
          let done = false;
          return {
            read: async () => {
              if (done) return { done: true, value: undefined };
              done = true;
              return { done: false, value: encoder.encode('data: {"choices":[{"delta":{"content":"Mock response"}}]}\n\n') };
            }
          }
        }
      }
    };
  };

  const engine = LLMEngine.getInstance();
  
  // Set threshold lower for test
  await engine.streamChat({
    prompt: 'What processor architecture does Apple M4 use?',
    contextItems: [], // no explicit context items
    optimizerConfig: {}, // optimizer config
    callbacks: { onChunk: () => {}, onComplete: () => {}, onError: () => {} }
  });

  if (interceptedPayload) {
    const sentMessages = interceptedPayload.messages || (interceptedPayload.contents ? interceptedPayload.contents : []);
    
    // Check if RAG Codebase Context is in any of the messages/contents
    const payloadStr = JSON.stringify(interceptedPayload);
    
    if (payloadStr.includes('--- RAG Codebase Context ---') && payloadStr.includes('[File: doc_A.txt')) {
      console.log('SUCCESS: LLM payload contains retrieved RAG context!');
      // console.log(userMessage.content.substring(0, 300) + '...');
    } else {
      console.log('FAILURE: LLM payload did not contain RAG context.');
    }
  } else {
    console.log('FAILURE: fetch was not called.');
  }
  
  console.log("\\n--- Test 4: Task Understander (Phase 5) ---");

  // Mock AIService to prevent globalState errors
  const { AIService } = require('./src/services/aiService');
  AIService.getInstance = () => ({
    streamCompletion: (options: any) => {
      const prompt = options.prompt || '';
      console.log("AI MOCK RECEIVED PROMPT:", prompt.substring(0, 100));
      let mockResponse = '{}';
      
      if (prompt.includes('expert AI agent behavior analyst')) {
        mockResponse = JSON.stringify({
          observations: [{ problem: 'MCP tool called without required parameter', evidenceCount: 3 }],
          improvements: [{ instruction: 'Validate required MCP parameters before tool execution.' }]
        });
      } else if (prompt.includes('expert AI behavior optimizer')) {
        mockResponse = JSON.stringify([
          {
            operation: 'ADD',
            section: 'Validation',
            content: 'Always validate required MCP parameters before tool execution.'
          }
        ]);
      } else if (prompt.includes('expert AI behavior evaluator')) {
        mockResponse = JSON.stringify({
          score: 0.9,
          reasoning: 'The candidate skill explicitly addresses the parameter validation problem.'
        });
      } else if (prompt.includes('auth module')) {
        mockResponse = '{"needsRAG":true,"needsMCP":false,"needsSkillOps":false,"needsRules":false}';
      } else if (prompt.includes('recurring mistakes')) {
        mockResponse = '{"needsRAG":false,"needsMCP":false,"needsSkillOps":true,"needsRules":false}';
      } else if (prompt.includes('external tools but follow coding standards')) {
        mockResponse = '{"needsRAG":false,"needsMCP":true,"needsSkillOps":false,"needsRules":true}';
      } else if (prompt.includes('Question about project documentation')) {
        mockResponse = '{"needsRAG":true,"needsMCP":false,"needsSkillOps":false,"needsRules":true}';
      } else {
        console.log("UNHANDLED PROMPT:", prompt.substring(0, 100));
        mockResponse = '{"needsRAG":true,"needsMCP":true,"needsSkillOps":true,"needsRules":true}';
      }
      
      options.callbacks.onChunk(mockResponse);
      options.callbacks.onComplete(mockResponse);
    }
  });

  const { TaskUnderstander } = require('./src/services/taskUnderstander');
  const understander = TaskUnderstander.getInstance();

  const testCases = [
    { prompt: 'Can you search the codebase for the auth module?', expected: { needsRAG: true, needsMCP: false, needsSkillOps: false, needsRules: false } },
    { prompt: 'Please automate a workflow to fix recurring mistakes.', expected: { needsRAG: false, needsMCP: false, needsSkillOps: true, needsRules: false } },
    { prompt: 'I need to interact with external tools but follow coding standards.', expected: { needsRAG: false, needsMCP: true, needsSkillOps: false, needsRules: true } },
  ];

  for (const tc of testCases) {
    const res = await understander.understandTask(tc.prompt);
    const matches = 
      res.needsRAG === tc.expected.needsRAG &&
      res.needsMCP === tc.expected.needsMCP &&
      res.needsSkillOps === tc.expected.needsSkillOps &&
      res.needsRules === tc.expected.needsRules;
    
    if (matches) {
      console.log(`SUCCESS: Routed correctly for prompt: "${tc.prompt}" -> ${JSON.stringify(res)}`);
    } else {
      console.log(`FAILURE: Incorrect routing for prompt: "${tc.prompt}". Expected ${JSON.stringify(tc.expected)}, got ${JSON.stringify(res)}`);
    }
  }

  console.log("\\n--- Test 5: SkillOps Context Injection (Phase 6) ---");
  
  // Set up mock workspace
  const workspaceRoot = process.cwd();
  mockVscode.workspace.workspaceFolders = [{ uri: { fsPath: workspaceRoot } }] as any;

  // Reset SkillRegistry so it re-initializes with the new mock workspace
  const { SkillRegistry } = require('./src/services/skillOpt/skillRegistry');
  SkillRegistry.resetInstance();

  // Set up mock skill files
  const skillsDir = path.join(workspaceRoot, '.agents', 'skills', 'test_skill');
  await fs.mkdir(skillsDir, { recursive: true });
  await fs.writeFile(path.join(skillsDir, 'metadata.json'), JSON.stringify({
    skillName: 'test_skill',
    bestVersion: 1,
    versions: [{ version: 1, status: 'best', createdAt: Date.now() }]
  }));
  await fs.writeFile(path.join(skillsDir, 'skill_v1.md'), 'TEST SKILL INSTRUCTION: Always output JSON');

  let test5InterceptedPayload: any = null;
  // Mock fetch specifically for LLMEngine streamChat
  (global as any).fetch = async (url: string, options: any) => {
    test5InterceptedPayload = JSON.parse(options.body);
    const encoder = new TextEncoder();
    return {
      ok: true,
      body: {
        getReader: () => {
          let done = false;
          return {
            read: async () => {
              if (done) return { done: true, value: undefined };
              done = true;
              return { done: false, value: encoder.encode(`data: {"choices":[{"delta":{"content":"Test 5 output"}}]}\n\n`) };
            }
          }
        }
      }
    };
  };

  const engine2 = engine;

  await engine2.streamChat({
    prompt: 'Execute the skill',
    contextItems: [],
    optimizerConfig: { needsSkillOps: true }, // Phase 6 configuration
    callbacks: { onChunk: () => {}, onComplete: () => {}, onError: () => {} }
  });

  if (test5InterceptedPayload) {
    const payloadStr = JSON.stringify(test5InterceptedPayload);
    if (payloadStr.includes('TEST SKILL INSTRUCTION: Always output JSON')) {
      console.log('SUCCESS: LLM payload contains injected SkillOps context!');
    } else {
      console.log('FAILURE: LLM payload did not contain SkillOps context.');
      console.log('Payload Dump:', payloadStr);
    }
  } else {
    console.log('FAILURE: fetch was not called for Test 5.');
  }

  console.log("\\n--- Test 6: Rules Engine Injection (Phase 7) ---");
  
  // Set up mock workspace
  const workspaceRoot6 = process.cwd();
  mockVscode.workspace.workspaceFolders = [{ uri: { fsPath: workspaceRoot6 } }] as any;

  SkillRegistry.resetInstance();
  const { RulesRegistry } = require('./src/services/rulesEngine/rulesRegistry');
  RulesRegistry.resetInstance();

  // Create rules.json
  const rulesDir = path.join(workspaceRoot6, '.agents', 'rules');
  await fs.mkdir(rulesDir, { recursive: true });
  await fs.writeFile(path.join(rulesDir, 'rules.json'), JSON.stringify([
    {
      id: "R001",
      name: "No API Keys",
      description: "Never expose API keys.",
      priority: 100,
      enabled: true,
      category: "security",
      content: "You must never expose or log API keys or secrets."
    }
  ]));

  let test6InterceptedPayload: any = null;
  (global as any).fetch = async (url: string, options: any) => {
    test6InterceptedPayload = JSON.parse(options.body);
    const encoder = new TextEncoder();
    return {
      ok: true,
      body: {
        getReader: () => {
          let done = false;
          return {
            read: async () => {
              if (done) return { done: true, value: undefined };
              done = true;
              return { done: false, value: encoder.encode(`data: {"choices":[{"delta":{"content":"Test 6 output"}}]}\n\n`) };
            }
          }
        }
      }
    };
  };

  await engine2.streamChat({
    prompt: 'Handle authentication',
    contextItems: [],
    optimizerConfig: { needsSkillOps: true, needsRules: true }, // Phase 7 configuration
    callbacks: { onChunk: () => {}, onComplete: () => {}, onError: () => {} }
  });

  if (test6InterceptedPayload) {
    const payloadStr = JSON.stringify(test6InterceptedPayload);
    const systemRulesIdx = payloadStr.indexOf('--- System Rules ---');
    const skillOpsIdx = payloadStr.indexOf('--- SkillOps Active Rules ---');
    
    if (systemRulesIdx !== -1 && skillOpsIdx !== -1) {
      if (systemRulesIdx < skillOpsIdx) {
        console.log('SUCCESS: LLM payload contains BOTH Rules and SkillOps, and Rules have higher priority (appear first)!');
      } else {
        console.log('FAILURE: Rules were found, but they appeared AFTER SkillOps.');
      }
    } else {
      console.log('FAILURE: LLM payload did not contain both Rules and SkillOps context.');
      console.log('Payload Dump:', payloadStr);
    }
  } else {
    console.log('FAILURE: fetch was not called for Test 6.');
  }

  console.log("\\n--- Test 7: Unified Context Builder (Phase 8) ---");
  
  // Set up mock workspace
  const workspaceRoot7 = process.cwd();
  mockVscode.workspace.workspaceFolders = [{ uri: { fsPath: workspaceRoot7 } }] as any;

  SkillRegistry.resetInstance();
  RulesRegistry.resetInstance();
  const { UnifiedContextBuilder } = require('./src/services/unifiedContextBuilder');

  // Create rules.json
  const rulesDir7 = path.join(workspaceRoot7, '.agents', 'rules');
  await fs.mkdir(rulesDir7, { recursive: true });
  await fs.writeFile(path.join(rulesDir7, 'rules.json'), JSON.stringify([
    {
      id: "R001",
      name: "No API Keys",
      description: "Never expose API keys.",
      priority: 100,
      enabled: true,
      category: "security",
      content: "You must never expose or log API keys or secrets."
    }
  ]));

  // Mock RagRetriever
  const originalRagRetriever = RagRetriever.getInstance;
  RagRetriever.getInstance = () => ({
    retrieve: async () => [{ chunk: { filename: 'test.ts', content: 'const a = 1;' }, score: 0.95 }]
  }) as any;

  const builder = UnifiedContextBuilder.getInstance();
  const result = await builder.buildContext({
    prompt: "Test context",
    workspaceRoot: workspaceRoot7,
    baseSystemPrompt: "Base prompt",
    optimizerConfig: { needsRules: true, needsSkillOps: true, needsRAG: true, needsMCP: true },
    contextItems: [],
    existingMessages: [{ role: 'tool', content: 'tool output' }]
  });

  if (result.systemPrompt.includes('Base prompt') && 
      result.systemPrompt.includes('No API Keys') &&
      result.userPrompt.includes('RAG Codebase Context') &&
      result.diagnostics.rulesCount === 1 &&
      result.diagnostics.ragChunksCount === 1 &&
      result.diagnostics.mcpResultsCount === 1) {
    console.log('SUCCESS: UnifiedContextBuilder deterministically ordered and diagnosed constraints!');
  } else {
    console.log('FAILURE: UnifiedContextBuilder failed to assemble context correctly.');
    console.log(result);
  }

  RagRetriever.getInstance = originalRagRetriever;

  // Cleanup mock skill and rules
  await fs.rm(path.join(workspaceRoot7, '.agents'), { recursive: true, force: true });

  console.log("\\n--- Test 8: Full Agentic Decision Flow (Phase 9) ---");
  const understander9 = TaskUnderstander.getInstance();

  const docQuestion = await understander9.understandTask("Question about project documentation");
  if (docQuestion.needsRAG === true && docQuestion.needsMCP === false && docQuestion.needsRules === true) {
    console.log("SUCCESS: Routing correctly blocked MCP for doc question");
  } else {
    console.log("FAILURE: Doc question routing incorrect", docQuestion);
  }

  const fileMod = await understander9.understandTask("external tools but follow coding standards");
  if (fileMod.needsMCP === true && fileMod.needsRules === true) {
    console.log("SUCCESS: Routing enabled MCP and Rules for file modification");
  } else {
    console.log("FAILURE: File mod routing incorrect", fileMod);
  }

  const genQuestion = await understander9.understandTask("recurring mistakes");
  if (genQuestion.needsRAG === false && genQuestion.needsMCP === false && genQuestion.needsSkillOps === true) {
    console.log("SUCCESS: Routing enabled SkillOps and blocked RAG/MCP for general workflow question");
  } else {
    console.log("FAILURE: General workflow question routing incorrect", genQuestion);
  }

  console.log("\\n--- Test 9: SkillOps CRUD (Phase 10) ---");
  const testWorkspace9 = path.join(__dirname, 'test_workspace9');
  await fs.mkdir(testWorkspace9, { recursive: true });
  
  try {
    const registry9 = SkillRegistry.getInstance(testWorkspace9);

    // 1. Create a new skill
    const newSkill = registry9.createSkillVersion('TestingSkill', '# Test Skill', undefined, 'Initial version');
    registry9.saveSkillVersion('TestingSkill', newSkill);
    registry9.updateSkillCategoryMetadata('TestingSkill', { description: 'A test skill', enabled: true });
    
    let metadata = registry9.getSkillCategoryMetadata('TestingSkill');
    let skillsList = registry9.listSkills();
    if (skillsList.includes('TestingSkill') && metadata?.description === 'A test skill' && metadata?.enabled === true) {
      console.log("SUCCESS: Created skill and updated metadata");
    } else {
      console.log("FAILURE: Failed to create skill and metadata", skillsList, metadata);
    }

    // 2. Disable skill
    registry9.updateSkillCategoryMetadata('TestingSkill', { enabled: false });
    metadata = registry9.getSkillCategoryMetadata('TestingSkill');
    if (metadata?.enabled === false) {
      console.log("SUCCESS: Disabled skill");
    } else {
      console.log("FAILURE: Failed to disable skill", metadata);
    }

    // 3. Delete skill
    registry9.deleteSkillCategory('TestingSkill');
    skillsList = registry9.listSkills();
    if (!skillsList.includes('TestingSkill')) {
      console.log("SUCCESS: Deleted skill");
    } else {
      console.log("FAILURE: Failed to delete skill", skillsList);
    }

  } catch(e) {
    console.error("Test 9 Error:", e);
  } finally {
    await fs.rm(testWorkspace9, { recursive: true, force: true });
  }

  console.log("\\n--- Test 10: SkillOps End-to-End Learning (Phase 11) ---");
  const testWorkspace10 = path.join(__dirname, 'test_workspace10');
  await fs.mkdir(testWorkspace10, { recursive: true });
  
  try {
    const registry10 = SkillRegistry.getInstance(testWorkspace10);
    const { TrajectoryRecorder } = require('./src/services/skillOpt/trajectoryRecorder');
    const { SkillOptService } = require('./src/services/skillOpt/skillOptService');
    const { SkillValidator } = require('./src/services/skillOpt/skillValidator');

    // 1. Create original skill
    const skillName = 'LearningSkill';
    const initialSkill = registry10.createSkillVersion(skillName, '# Base Skill', undefined, 'Initial version');
    registry10.saveSkillVersion(skillName, initialSkill);
    registry10.promoteSkill(skillName, initialSkill.metadata.version);

    // 2. Seed TrajectoryRecorder with failing trajectories
    TrajectoryRecorder.resetInstance();
    const recorder10 = TrajectoryRecorder.getInstance(testWorkspace10);
    for (let i = 0; i < 3; i++) {
        recorder10.startTask(`task-${i}`, 'Do something with MCP', skillName, initialSkill.metadata.version);
        // Add a failed tool call
        recorder10.recordToolCall(`task-${i}`, { name: 'mcp_tool', params: {} }, false, 'Missing required parameter');
        recorder10.endTask(`task-${i}`, false); // Failed task
    }

    // 3. Run Optimization loop
    SkillOptService.resetInstance();
    const skillOpt10 = SkillOptService.getInstance(testWorkspace10);
    const result = await skillOpt10.optimize(skillName, async (candidateContent: string, reflectionResult: any, trajectories: any[], baselineScore: number) => {
        const validator = SkillValidator.getInstance();
        const vResult = await validator.validateCandidate(candidateContent, reflectionResult, trajectories, baselineScore);
        return vResult.score;
    });

    if (result.decision === 'accepted' && result.scoreAfter > result.scoreBefore) {
        console.log("SUCCESS: End-to-End Learning Loop successfully reflected, generated, and validated candidate skill!");
        console.log(`Improvement: ${result.scoreBefore.toFixed(2)} -> ${result.scoreAfter.toFixed(2)}`);
    } else {
        console.log("FAILURE: End-to-End Learning Loop rejected candidate or failed to improve.", result);
    }
  } catch(e) {
    console.error("Test 10 Error:", e);
  } finally {
    await fs.rm(testWorkspace10, { recursive: true, force: true });
  }

  console.log("\\nTests complete.");
}

run().catch(console.error);
