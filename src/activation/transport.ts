import { appendEgress } from './egress.js';

const ALLOWED_HOST = process.env.RONIN_HQ_HOST ?? 'hq.ronincowork.com';

const TIMEOUT_MS = 15_000;

export interface HqResponse<T> {
  status: number;
  body: T | null;
  requestId: string | null;
  error: { code: string; message: string; retryable: boolean } | null;
}

export class EgressRefused extends Error {}

function assertAllowed(url: URL): void {
  if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    throw new EgressRefused(`refusing plaintext egress to ${url.hostname}`);
  }
  if (url.hostname !== ALLOWED_HOST && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    throw new EgressRefused(`${url.hostname} is not the allowlisted Ronin host`);
  }
}

export async function callHq<T>(
  method: string,
  pathname: string,
  opts: { body?: unknown; token?: string; base?: string } = {},
): Promise<HqResponse<T>> {
  const base = opts.base ?? process.env.RONIN_HQ_BASE ?? `https://${ALLOWED_HOST}`;
  const url = new URL(pathname, base);
  assertAllowed(url);

  const started = Date.now();
  let status = 0;
  let outcome = 'error';

  try {
    const res = await fetch(url, {
      method,
      headers: {
        ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        'user-agent': 'ronin-cowork',
      },
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'error', // a redirect off the allowlisted host is not a thing we follow
    });

    status = res.status;
    outcome = res.ok ? 'ok' : 'refused';
    const requestId = res.headers.get('x-request-id');
    const text = await res.text();
    let parsed: any = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* HTML, or empty */ }

    return {
      status,
      requestId,
      body: res.ok ? (parsed as T) : null,
      error: !res.ok && parsed?.error ? parsed.error : null,
    };
  } catch (e) {
    outcome = e instanceof EgressRefused ? 'refused-by-allowlist' : 'unreachable';
    throw e;
  } finally {
    await appendEgress({
      at: new Date().toISOString(),
      host: url.hostname,
      method,
      path: url.pathname,
      status,
      outcome,
      ms: Date.now() - started,
    }).catch(() => { /* never let bookkeeping fail the call */ });
  }
}
