export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface EvidenceItem<T> {
  value: T;
  source: string;
  confidence: ConfidenceLevel;
  accessibilityStatus: 'ACCESSIBLE' | 'UNAVAILABLE' | 'NOT_APPLICABLE' | 'UNKNOWN';
  timestamp: string;
  verificationMethod: string;
}

export interface RuntimeDiagnostic {
  timestamp: string;
  agent: {
    name: EvidenceItem<string>;
    version: EvidenceItem<string>;
    runtime: EvidenceItem<string>;
    os: EvidenceItem<string>;
  };
  llm: {
    provider: EvidenceItem<string>;
    model_id: EvidenceItem<string>;
    model_name: EvidenceItem<string>;
    model_family: EvidenceItem<string>;
    model_version: EvidenceItem<string>;
    parameters: EvidenceItem<string>;
    quantization: EvidenceItem<string>;
    context_length: EvidenceItem<number | null>;
    architecture: EvidenceItem<string>;
    tokenizer: EvidenceItem<string>;
  };
  inference_server: {
    type: EvidenceItem<string>;
    version: EvidenceItem<string>;
    endpoint: EvidenceItem<string>;
    local_or_remote: EvidenceItem<'LOCAL' | 'REMOTE' | 'HYBRID' | 'UNKNOWN'>;
  };
  hardware: {
    cpu: EvidenceItem<string>;
    gpu: EvidenceItem<string>;
    ram_gb: EvidenceItem<number | null>;
    vram_gb: EvidenceItem<number | null>;
  };
  configuration: {
    context_size: EvidenceItem<number | null>;
    batch_size: EvidenceItem<number | null>;
    threads: EvidenceItem<number | null>;
    gpu_layers: EvidenceItem<number | null>;
    flash_attention: EvidenceItem<boolean | null>;
  };
  performance: {
    ttft_ms: EvidenceItem<number | null>;
    prompt_tokens_per_second: EvidenceItem<number | null>;
    generation_tokens_per_second: EvidenceItem<number | null>;
    p50_ms: EvidenceItem<number | null>;
    p95_ms: EvidenceItem<number | null>;
  };
  capabilities: {
    streaming: EvidenceItem<boolean | null>;
    tool_calling: EvidenceItem<boolean | null>;
    vision: EvidenceItem<boolean | null>;
    reasoning: EvidenceItem<boolean | null>;
  };
  limitations: EvidenceItem<string[]>;
}

export const createUnknownEvidence = <T>(reason: string, value: T): EvidenceItem<T> => ({
    value,
    source: 'UNKNOWN',
    confidence: 'UNKNOWN',
    accessibilityStatus: 'UNAVAILABLE',
    timestamp: new Date().toISOString(),
    verificationMethod: reason
});

export const createEvidence = <T>(value: T, source: string, confidence: ConfidenceLevel, method: string): EvidenceItem<T> => ({
    value,
    source,
    confidence,
    accessibilityStatus: 'ACCESSIBLE',
    timestamp: new Date().toISOString(),
    verificationMethod: method
});
