export class LlamaCppProber {
    public static async probeProps(apiBase: string, headers: Record<string, string>): Promise<any | null> {
        try {
            const base = apiBase.replace(/\/v1\/?$/, '').replace(/\/+$/, '');
            const endpoint = `${base}/props`;
            const res = await fetch(endpoint, { method: 'GET', headers });
            if (res.ok) {
                return await res.json();
            }
        } catch (e) {
            // Ignore
        }
        return null;
    }

    public static async probeHealth(apiBase: string, headers: Record<string, string>): Promise<any | null> {
        try {
            const base = apiBase.replace(/\/v1\/?$/, '').replace(/\/+$/, '');
            const endpoint = `${base}/health`;
            const res = await fetch(endpoint, { method: 'GET', headers });
            if (res.ok) {
                return await res.json();
            }
        } catch (e) {
            // Ignore
        }
        return null;
    }
}
