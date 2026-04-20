/**
 * Minimal HTTP client port — kept narrow so the webhook dispatcher can be
 * tested without spinning up a real server. Real adapter wraps Node's
 * fetch with timeout + redirect handling.
 */

export interface HttpRequest {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: string;
  timeoutMs?: number;
}

export interface HttpResponse {
  status: number;
  body: string;
}

export interface HttpClient {
  send(request: HttpRequest): Promise<HttpResponse>;
}
