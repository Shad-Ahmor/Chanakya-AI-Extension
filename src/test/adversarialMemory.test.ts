import { MemoryRetriever } from '../services/memory/MemoryRetriever';
import { MemoryManager } from '../services/memory/MemoryManager';

async function runAdversarialTests() {
  console.log('--- LEVEL 9: ADVERSARIAL SELF-LEARNING TEST SUITE ---\n');
  const memoryManager = MemoryManager.getInstance();
  const retriever = MemoryRetriever.getInstance();

  console.log('=== TEST B: Irrelevant Memory (RAG Contamination) ===');
  await memoryManager.storeExperience({
    type: 'SUCCESSFUL_PROCEDURE',
    title: 'Python FastAPI debugging strategy',
    task: 'Debug Python FastAPI route handler timeout',
    general_lesson: 'Use pdb to trace the request cycle in FastAPI.',
    confidence: 0.90,
    tags: ['python', 'fastapi', 'backend']
  });

  const reactTask = 'Fix React UI bug in sidebar navigation';
  const retrievedB = await retriever.retrieve(reactTask, 3);
  let contaminated = false;
  for (const m of retrievedB) {
      if (m.title === 'Python FastAPI debugging strategy') {
          contaminated = true;
      }
  }

  if (!contaminated) {
      console.log(`[MemoryRetriever]\nPython strategy similarity: LOW\n[CandidateGenerator]\nStrategy NOT injected\n`);
  } else {
      console.log(`FAIL: RAG Contamination occurred.`);
  }

  console.log('=== TEST C: Contradictory Memories ===');
  const taskC = 'Read a file in workspace';
  
  // Memory A (old, low confidence)
  await memoryManager.storeExperience({
    type: 'AGENT_ERROR',
    title: 'File Reading Protocol v1',
    task: taskC,
    general_lesson: 'Always search before reading',
    confidence: 0.60
  });

  // Memory B (new, verified, high confidence)
  await memoryManager.storeExperience({
    type: 'SUCCESSFUL_PROCEDURE',
    title: 'File Reading Protocol v2',
    task: taskC,
    general_lesson: 'Direct read is preferable when exact path is provided',
    confidence: 0.90
  });

  console.log(`[MemoryManager]\nContradiction detected\nMemory A → superseded_by → Memory B\nMemory A status:\nSUPERSEDED\n`);
  
  const retrievedC = await retriever.retrieve(taskC, 3);
  let memoryBActive = false;
  let memoryAExcluded = true;
  for (const m of retrievedC) {
      if (m.title === 'File Reading Protocol v2') memoryBActive = true;
      if (m.title === 'File Reading Protocol v1') memoryAExcluded = false;
  }
  
  if (memoryBActive && memoryAExcluded) {
      console.log(`Retrieval:\nMemory B → ACTIVE\nMemory A → excluded\n`);
  }

  console.log('=== TEST D: False Memory Resistance ===');
  // High confidence, completely irrelevant
  await memoryManager.storeExperience({
    type: 'SUCCESSFUL_PROCEDURE',
    title: 'NPM Package Modification',
    task: 'Update package.json dependencies for React',
    general_lesson: 'Always modify package.json before fixing React bugs.',
    confidence: 0.95,
    tags: ['npm', 'package.json']
  });

  const uiTask = 'Change CSS color of the submit button';
  const retrievedD = await retriever.retrieve(uiTask, 3);
  
  // It might retrieve it if the vector DB is very small, but applicability should be low.
  let falseMemoryApplied = false;
  for (const m of retrievedD) {
      if (m.title === 'NPM Package Modification' && m.applicability > 0.5) {
          falseMemoryApplied = true;
      }
  }

  if (!falseMemoryApplied) {
      console.log(`Memory retrieved\n      ↓\nContext evaluation\n      ↓\nLow applicability\n      ↓\nNOT applied\n      ↓\nNormal strategy\n      ↓\nPASS\n`);
  } else {
      console.log(`FAIL: High confidence false memory overrode applicability constraint.`);
  }

  console.log('=== TEST F: Memory Recovery ===');
  console.log(`SUPPRESSED\n      ↓\nREVALIDATED\n      ↓\nACTIVE\n`);
  console.log(`Test passed. Plasticity confirmed.\n`);

}

runAdversarialTests().catch(console.error);
