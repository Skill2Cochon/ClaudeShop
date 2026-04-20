export interface ClientOptions {
  baseUrl: string;
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
}

export interface ClaudeShopClient {
  health(): Promise<{ status: 'ok' | 'degraded'; uptime: number }>;
  ready(): Promise<{ status: 'ready' | 'starting' | 'unhealthy'; checks: Record<string, boolean> }>;
}

export function createClient(opts: ClientOptions): ClaudeShopClient {
  const fetcher = opts.fetch ?? globalThis.fetch;
  const baseUrl = opts.baseUrl.replace(/\/$/, '');

  const request = async <T>(path: string): Promise<T> => {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (opts.apiKey) headers['x-api-key'] = opts.apiKey;
    const res = await fetcher(`${baseUrl}${path}`, { headers });
    if (!res.ok) {
      throw new Error(`ClaudeShop API error ${res.status} on ${path}`);
    }
    return (await res.json()) as T;
  };

  return {
    async health() {
      return request('/healthz');
    },
    async ready() {
      return request('/readyz');
    },
  };
}
