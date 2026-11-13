import type { Shade } from './types';

/** Shared-world server. Empty means offline: the realm is still seeded, graves are wanderers only. */
const API: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
export const online = API !== '';

async function call<T>(path: string, body?: unknown): Promise<T | null> {
  if (!API) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 2500);
  try {
    const res = await fetch(API + path, {
      method: body ? 'POST' : 'GET', signal: ctl.signal,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

export const fetchShades = async (week: number) => (await call<Shade[]>(`/v1/shades?week=${week}`)) ?? [];
export const postShade = async (owner: string, shade: Shade) => (await call('/v1/shades', { owner, shade })) !== null;
export const postCandle = async (from: string, shadeId: string) => (await call('/v1/candles', { from, shadeId })) !== null;
export const claimCandles = async (owner: string) =>
  (await call<{ shadeId: string; count: number }[]>('/v1/candles/claim', { owner })) ?? [];
