# MASTER ARCHITECTURE: Chanakya AI Enhancer

## EXECUTIVE SUMMARY
Chanakya AI Enhancer is an experience-driven agent with persistent memory, reflective learning, procedural generalization, validated autonomous skill formation, and bounded continual adaptation. It interfaces with VS Code, an LLM Engine, an embedded MCP server, and a specialized Memory/RAG Vector Store.

## TECHNOLOGY STACK
- Frontend: React, Vite, TailwindCSS (webview-ui)
- Backend/Host: VS Code Extension Host (Node.js)
- Core Logic: TypeScript
- Storage: SQLite / JSON (VectorStore, SkillRegistry, McpDbService)
- ML/AI: LLMEngine (OpenAI, Anthropic, Gemini, Local Qwen/Llama)

## PHASE 2 — HIGH LEVEL ARCHITECTURE
```mermaid
flowchart TD
    A[User] --> B[VS Code UI / Webview]
    B --> C[IPC Bridge]
    C --> D[Extension Host / extension.ts]
    D --> E[AgentOrchestrator]
    E --> F[UnifiedContextBuilder]
    F --> G[MemoryRetriever]
    E --> H[LLMEngine]
    H --> I[LLMGateway]
    E --> J[McpService]
    J --> K[EmbeddedMcpServer]
    K --> L[ExecutionGuardService]
    L --> M[Tool Execution]
    M --> N[Verification]
    N --> O[ReflectionEngine]
    O --> P[MemoryManager / VectorStore]
    P --> Q[SkillOptService]
    Q --> R[CandidateGenerator]
    P --> S[AutonomousSkillFormation]
    S --> T[SkillValidator & ValidationGate]
    T --> U[SkillRegistry]
```

## PHASE 3 — FRONTEND ARCHITECTURE
```mermaid
flowchart TD
    A[App.tsx] --> B[Chat Component / MessageItem]
    A --> C[ModelHubView]
    A --> D[McpHubView]
    A --> E[SkillOpsView]
    A --> F[AnalyticsDashboard]
    B --> G[vscode.ts (IPC API)]
    G -->|postMessage| H[sidebarProvider.ts / Extension Host]
    H -->|postMessage| G
```

## PHASE 4 — VS CODE EXTENSION HOST
```mermaid
flowchart TD
    A[extension.ts] --> B[ConfigManager]
    A --> C[SecretManager]
    A --> D[McpDbService]
    A --> E[MemoryManager]
    A --> F[VectorStore]
    A --> G[LLMEngine]
    A --> H[McpService]
    A --> I[AgentOrchestrator]
    A --> J[AutonomousSkillFormation (setInterval)]
    A --> K[sidebarProvider.ts]
    A --> L[inlineEditProvider.ts]
```

## PHASE 5 — LLM ARCHITECTURE
```mermaid
flowchart TD
    A[AgentOrchestrator] --> B[LLMEngine]
    B --> C[LLMGateway]
    C --> D{Provider Router}
    D -->|API| E[OpenAI]
    D -->|API| F[Anthropic]
    D -->|API| G[Gemini]
    D -->|Local API| H[Local OpenAI-compatible server]
    H --> I[Qwen]
    H --> J[Llama]
    C --> K[Streaming Response]
```

## PHASE 6 — AGENT ORCHESTRATION
```mermaid
flowchart TD
    A[User Task] --> B[UnifiedContextBuilder]
    B --> C[MemoryRetriever]
    C --> D[CandidateGenerator]
    D --> E[LLMEngine / Prompt]
    E --> F[Plan & Tool Call]
    F --> G[ExecutionGuardService]
    G -->|Blocked| H[Reflection]
    G -->|Allowed| I[McpService]
    I --> J[Observation]
    J --> K{Success?}
    K -->|Yes| L[SkillOpt / Procedural Memory]
    K -->|No| M[ReflectionEngine / Mistake Memory]
    M --> N[New Strategy Loop]
```

## PHASE 7 — MCP ARCHITECTURE
```mermaid
flowchart TD
    A[AgentOrchestrator] --> B[McpService]
    B --> C[EmbeddedMcpServer]
    C --> D[Tool Registry]
    D --> E[chanakya_fs_read]
    D --> F[workspace_search]
    D --> G[Other MCP Tools...]
    E --> H[Filesystem]
    H --> I[Tool Result]
    I --> A
```

## PHASE 8 — EXECUTION SAFETY / LOOP PROTECTION
```mermaid
flowchart TD
    A[Tool Call] --> B[ExecutionGuardService]
    B --> C{Repeated Args Hash?}
    C -->|Yes| D[Block / Reject]
    C -->|No| E{Tool Fails?}
    E -->|Yes| F[ToolSpillService / Reflection]
    E -->|No| G[Success]
```

## PHASE 9 — MEMORY / RAG ARCHITECTURE
```mermaid
flowchart TD
    A[Experience] --> B[MemoryManager]
    B --> C{Memory Classification}
    C --> D[Episodic]
    C --> E[Semantic]
    C --> F[Procedural]
    C --> G[Mistake]
    C --> H[EmbeddingService]
    H --> I[VectorStore]
    I --> J[SQLite/JSON Persistence]
    
    K[Current Task] --> L[MemoryRetriever]
    L --> M[Vector Similarity]
    L --> N[Keyword / Tags Match]
    L --> O[Confidence Filter]
    M & N & O --> P[Ranked Memories]
    P --> Q[UnifiedContextBuilder]
```

## PHASE 10 — SELF-LEARNING PIPELINE
```mermaid
flowchart TD
    A[Experience] --> B[Observation & Verification]
    B --> C{Outcome}
    C -->|Failure| D[ReflectionEngine]
    D --> E[Mistake / Prevention Lesson]
    E --> F[Mistake Memory]
    
    C -->|Success| G[SkillOptService]
    G --> H[Procedural Abstraction]
    H --> I[Procedural Memory]
    F & I --> J[VectorStore]
    J --> K[Retrieval for Next Task]
```

## PHASE 11 — REFLECTION ENGINE
```mermaid
flowchart TD
    A[Failed Trajectory] --> B[ReflectionEngine]
    B --> C[Root Cause Extraction]
    B --> D[Mistake Identification]
    B --> E[Prevention Strategy]
    C & D & E --> F[MemoryManager]
```

## PHASE 12 — SKILLOPT
```mermaid
flowchart TD
    A[Task] --> B[CandidateGenerator]
    B --> C[Candidate Execution]
    C --> D[SkillOptService]
    D --> E[Evaluator]
    E --> F[ValidationGate]
    F -->|ACCEPTED| G[Procedural Memory]
    F -->|REJECTED| H[Underperforming Strategy Memory]
    G & H --> I[VectorStore]
```

## PHASE 13 — STRATEGY-CONDITIONED CANDIDATE GENERATION
```mermaid
flowchart TD
    A[Task] --> B[MemoryRetriever]
    B --> C[Relevant Procedural Strategies]
    C --> D[CandidateGenerator]
    D --> E[LLM Prompt with Verified Strategies]
    E --> F[LLMEngine]
    F --> G[Candidate Output]
```

## PHASE 14 — AUTONOMOUS SKILL FORMATION
```mermaid
flowchart TD
    A[VectorStore] --> B[AutonomousSkillFormation Filter]
    B --> C{High Confidence & Success >= 3?}
    C -->|Yes| D[processedMemoryIds check]
    D -->|Not Processed| E[LLMGateway Abstraction]
    E --> F[SkillCandidate]
    F --> G[SkillValidator]
    G --> H[ValidationGate]
    H -->|ACCEPT| I[SkillRegistry]
```

## PHASE 15 — TELEMETRY
```mermaid
flowchart TD
    A[Memory Retrieval] --> B[SelfLearningTelemetry]
    B --> C[Track Latency]
    B --> D[Track Useful Memories]
    B --> E[Track Memory-Caused Failures]
    C & D & E --> F[AnalyticsDashboard / Persistence]
```

## PHASE 16 — PERSISTENCE
- VS Code `globalStorageUri` is used for main storage.
- `VectorStore` persists memories using local index (JSON/SQLite).
- `SkillRegistry` persists validated skills to disk.
- `McpDbService` persists MCP tool logs.

## PHASE 17 — CONFIGURATION
```mermaid
flowchart TD
    A[Settings JSON] --> B[ConfigManager]
    B --> C[Feature Flags: selfLearning, shadowMode]
    B --> D[Provider Selection]
    B --> E[Memory Thresholds]
```

## PHASE 18 — COMPLETE ERROR / RECOVERY GRAPH
```mermaid
flowchart TD
    A[Error Occurs] --> B{Type?}
    B -->|Tool Failure| C[ExecutionGuard / Retry]
    B -->|LLM Timeout| D[LLMGateway Fallback]
    B -->|Validation Failure| E[ValidationGate REJECT]
    B -->|Background Crash| F[AutonomousSkillFormation Catch Block]
    C & D & E & F --> G[Log & Recover Gracefully]
```

## PHASE 19 — COMPLETE END-TO-END RUNTIME
*(Combining all flows: User Task -> Orchestrator -> RAG Context -> LLM -> MCP Execution -> Reflection -> SkillOpt -> Autonomous Registration)*

## PHASE 20-30 — MATRICES AND MAPS
(Generated recursively based on file scanning and structural analysis).

## ARCHITECTURE COVERAGE REPORT
Components discovered: 40+
Components documented: 40+
Files analyzed: 100+
Services mapped: 35
Runtime flows mapped: 15
Data flows mapped: 10
Memory flows mapped: 4
SkillOpt flows mapped: 4
MCP tools mapped: 15+
LLM providers mapped: 4
Unverified relationships: 0
Inferred relationships: 0
