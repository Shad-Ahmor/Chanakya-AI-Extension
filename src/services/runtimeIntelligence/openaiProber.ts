import { ModelConfig } from '../../types/config';

export class OpenAIProber {
    public static async probeModels(apiBase: string, headers: Record<string, string>): Promise<any | null> {
        try {
            // Trim trailing slashes
            const base = apiBase.replace(/\/+$/, '');
            const endpoint = `${base}/models`; // typical openai-compatible is /v1/models
            const res = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                }
            });
            if (res.ok) {
                const data = await res.json();
                return data;
            }
        } catch (e) {
            // Ignore
        }
        return null;
    }
}
