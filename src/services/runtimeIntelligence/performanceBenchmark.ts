import { EvidenceItem, createEvidence, createUnknownEvidence } from './types';

export class PerformanceBenchmark {
    /**
     * Executes a streaming inference request against the OpenAI-compatible endpoint
     * to measure Time To First Token (TTFT) and Tokens Per Second (TPS).
     */
    public static async runBenchmark(apiBase: string, modelName: string, headers: Record<string, string>): Promise<{
        ttft_ms: EvidenceItem<number | null>;
        prompt_tokens_per_second: EvidenceItem<number | null>;
        generation_tokens_per_second: EvidenceItem<number | null>;
    }> {
        const endpoint = `${apiBase.replace(/\/+$/, '')}/chat/completions`;
        const prompt = "Please count from 1 to 20."; // A deterministic, simple prompt
        
        const payload = {
            model: modelName,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
            temperature: 0.0,
            max_tokens: 50
        };

        const startTime = performance.now();
        let firstTokenTime: number | null = null;
        let tokenCount = 0;

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok || !res.body) {
                throw new Error(`Benchmark failed: ${res.status}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                if (chunk.includes('data: ') && chunk.includes('"delta"')) {
                    if (firstTokenTime === null) {
                        firstTokenTime = performance.now();
                    }
                    // Very rough token approximation - count JSON chunks that have content
                    if (chunk.includes('"content"')) {
                        tokenCount++;
                    }
                }
            }
            const endTime = performance.now();

            if (firstTokenTime !== null) {
                const ttftMs = Math.round(firstTokenTime - startTime);
                const genTimeMs = endTime - firstTokenTime;
                
                // If it finished too fast to measure generation time properly
                const tps = genTimeMs > 0 ? Math.round((tokenCount / genTimeMs) * 1000) : null;
                
                return {
                    ttft_ms: createEvidence(ttftMs, 'Direct Benchmark', 'HIGH', `Measured TTFT with ${payload.max_tokens} token prompt`),
                    prompt_tokens_per_second: createUnknownEvidence('Not measured in this test', null),
                    generation_tokens_per_second: tps !== null ? createEvidence(tps, 'Direct Benchmark', 'HIGH', `Generated ${tokenCount} chunks in ${Math.round(genTimeMs)}ms`) : createUnknownEvidence('Too fast to measure', null)
                };
            }
        } catch (e) {
            // Benchmark failed
        }

        return {
            ttft_ms: createUnknownEvidence('Benchmark failed', null),
            prompt_tokens_per_second: createUnknownEvidence('Benchmark failed', null),
            generation_tokens_per_second: createUnknownEvidence('Benchmark failed', null),
        };
    }
}
