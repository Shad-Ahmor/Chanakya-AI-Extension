import { RuntimeDiagnostic, createEvidence, createUnknownEvidence } from './types';
import { Logger } from '../../utils/logger';
import { ConfigManager } from '../configManager';
import * as os from 'os';
import { HardwareDiscovery } from './hardwareDiscovery';
import { OpenAIProber } from './openaiProber';
import { LlamaCppProber } from './llamacppProber';
import { SecretManager } from '../secretManager';
import { PerformanceBenchmark } from './performanceBenchmark';

export class RuntimeIntelligenceService {
    private static instance: RuntimeIntelligenceService;
    private logger = Logger.getInstance();

    private constructor() {}

    public static getInstance(): RuntimeIntelligenceService {
        if (!RuntimeIntelligenceService.instance) {
            RuntimeIntelligenceService.instance = new RuntimeIntelligenceService();
        }
        return RuntimeIntelligenceService.instance;
    }

    public async getRuntimeIntelligence(): Promise<RuntimeDiagnostic> {
        this.logger.log('Starting Runtime Intelligence Gathering...');
        const timestamp = new Date().toISOString();
        
        // --- PHASE 1 & 6: Hardware Discovery ---
        const hardware = await HardwareDiscovery.getInstance().discoverHardware();
        
        // --- PHASE 2: Active Model Discovery ---
        const configManager = ConfigManager.getInstance();
        const config = configManager.getConfig();
        const activeModelId = config.activeChatModelId;
        const activeModel = config.models.find(m => m.id === activeModelId || m.name === activeModelId);
        
        let provider = createUnknownEvidence('No active model', 'UNKNOWN');
        let modelId = createUnknownEvidence('No active model', 'UNKNOWN');
        let modelName = createUnknownEvidence('No active model', 'UNKNOWN');
        
        let apiBase = '';
        let headers: Record<string, string> = {};

        if (activeModel) {
            provider = createEvidence(activeModel.provider, 'ConfigManager', 'HIGH', 'Read from active configuration');
            modelId = createEvidence(activeModel.model, 'ConfigManager', 'HIGH', 'Read from active configuration');
            modelName = createEvidence(activeModel.name, 'ConfigManager', 'HIGH', 'Read from active configuration');
            
            apiBase = activeModel.apiBase || 'https://api.openai.com/v1';
            try {
                const apiKey = await SecretManager.getInstance().getApiKey(activeModel.provider);
                if (apiKey) {
                    headers['Authorization'] = `Bearer ${apiKey}`; // Will be redacted later
                }
            } catch (e) {
                this.logger.warn('SecretManager not initialized, skipping API key');
            }
        }

        // --- PHASE 3 & 4: Server Probing ---
        let contextLength: number | null = null;
        let gpuLayers: number | null = null;
        
        let serverType = 'UNKNOWN';
        let serverVersion = 'UNKNOWN';
        let serverEndpoint = apiBase;
        let isLocal: 'LOCAL' | 'REMOTE' | 'HYBRID' | 'UNKNOWN' = 'UNKNOWN';
        
        if (activeModel) {
            if (activeModel.provider === 'ollama' || activeModel.provider === 'lmstudio' || activeModel.provider === 'custom' || activeModel.provider === 'vllm') {
                isLocal = 'LOCAL';
                const props = await LlamaCppProber.probeProps(apiBase, headers);
                if (props) {
                    serverType = 'llama.cpp';
                    serverVersion = props.default_generation_settings?.model || 'UNKNOWN';
                    contextLength = props.default_generation_settings?.n_ctx || null;
                    gpuLayers = props.default_generation_settings?.n_gpu_layers || null;
                } else {
                    const models = await OpenAIProber.probeModels(apiBase, headers);
                    if (models) {
                        serverType = 'openai-compatible';
                    }
                }
            } else {
                isLocal = 'REMOTE';
                serverType = 'cloud-api';
            }
        }

        // --- PHASE 8: Performance Benchmark ---
        let ttft_ms = createUnknownEvidence<number | null>('Not implemented', null);
        let prompt_tps = createUnknownEvidence<number | null>('Not implemented', null);
        let gen_tps = createUnknownEvidence<number | null>('Not implemented', null);
        
        if (activeModel && isLocal === 'LOCAL' && serverType === 'llama.cpp') {
            const perf = await PerformanceBenchmark.runBenchmark(apiBase, activeModel.model, headers);
            ttft_ms = perf.ttft_ms;
            prompt_tps = perf.prompt_tokens_per_second;
            gen_tps = perf.generation_tokens_per_second;
        }

        const diagnostic: RuntimeDiagnostic = {
            timestamp,
            agent: {
                name: createEvidence('Chanakya AI', 'Hardcoded', 'HIGH', 'Agent codebase inspection'),
                version: createUnknownEvidence('Version file not parsed yet', 'UNKNOWN'),
                runtime: createEvidence(`Node.js ${process.version}`, 'process.version', 'HIGH', 'Read from process env'),
                os: createEvidence(`${os.platform()} ${os.release()} (${os.arch()})`, 'os module', 'HIGH', 'Node.js os module call')
            },
            llm: {
                provider,
                model_id: modelId,
                model_name: modelName,
                model_family: createUnknownEvidence('Not implemented', 'UNKNOWN'),
                model_version: createUnknownEvidence('Not implemented', 'UNKNOWN'),
                parameters: createUnknownEvidence('Not implemented', 'UNKNOWN'),
                quantization: createUnknownEvidence('Not implemented', 'UNKNOWN'),
                context_length: contextLength ? createEvidence(contextLength, 'GET /props', 'HIGH', 'Probed from running server') : createUnknownEvidence('Not implemented', null),
                architecture: createUnknownEvidence('Not implemented', 'UNKNOWN'),
                tokenizer: createUnknownEvidence('Not implemented', 'UNKNOWN')
            },
            inference_server: {
                type: serverType !== 'UNKNOWN' ? createEvidence(serverType, 'API Probing', 'HIGH', 'HTTP GET discovery') : createUnknownEvidence('Server unreachable', 'UNKNOWN'),
                version: serverVersion !== 'UNKNOWN' ? createEvidence(serverVersion, 'GET /props', 'HIGH', 'HTTP GET discovery') : createUnknownEvidence('Server unreachable', 'UNKNOWN'),
                endpoint: createEvidence(this.redactSensitive(serverEndpoint), 'Config', 'HIGH', 'Config lookup'),
                local_or_remote: createEvidence(isLocal, 'Config Rules', 'MEDIUM', 'Inferred from provider name')
            },
            hardware,
            configuration: {
                context_size: contextLength ? createEvidence(contextLength, 'GET /props', 'HIGH', 'Probed from server') : createUnknownEvidence('Not implemented', null),
                batch_size: createUnknownEvidence('Not implemented', null),
                threads: createUnknownEvidence('Not implemented', null),
                gpu_layers: gpuLayers ? createEvidence(gpuLayers, 'GET /props', 'HIGH', 'Probed from server') : createUnknownEvidence('Not implemented', null),
                flash_attention: createUnknownEvidence('Not implemented', null)
            },
            performance: {
                ttft_ms,
                prompt_tokens_per_second: prompt_tps,
                generation_tokens_per_second: gen_tps,
                p50_ms: createUnknownEvidence('Not implemented', null),
                p95_ms: createUnknownEvidence('Not implemented', null)
            },
            capabilities: {
                streaming: createUnknownEvidence('Not implemented', null),
                tool_calling: createUnknownEvidence('Not implemented', null),
                vision: createUnknownEvidence('Not implemented', null),
                reasoning: createUnknownEvidence('Not implemented', null)
            },
            limitations: createUnknownEvidence('Not implemented', [])
        };

        return diagnostic;
    }

    private redactSensitive(str: string): string {
        return str.replace(/Bearer\s+[a-zA-Z0-9\-_]+/, 'Bearer [REDACTED]')
                  .replace(/key=[a-zA-Z0-9\-_]+/, 'key=[REDACTED]');
    }
}
