import type { HttpClient, HttpRequest, HttpResponse } from '@claudeshop/core';

/**
 * Node fetch-backed HttpClient with a hard timeout via AbortController.
 * Used by the webhook dispatcher.
 */
export class FetchHttpClient implements HttpClient {
  async send(request: HttpRequest): Promise<HttpResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      request.timeoutMs ?? 10_000,
    );
    try {
      const res = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: controller.signal,
      });
      const body = await res.text();
      return { status: res.status, body };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
