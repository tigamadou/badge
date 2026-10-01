// MVP rate-limit (Plan v2-05). 3 limitations connues :
// 1. compteurs en memoire par process : limite effective = N_workers * DEFAULT_MAX.
// 2. extractClientIp trust le premier segment x-forwarded-for (spoofable depuis le client).
// 3. Map non bornee : les buckets stales sont reset au prochain acces, jamais supprimes.
// Reprises prevues en v3 (backend Redis + parsing XFF rightmost-after-trusted-proxy).

export const DEFAULT_WINDOW_MS = 60_000;
export const DEFAULT_MAX = 10;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterMs: number };

export function checkRateLimit(
  ip: string,
  route: string,
  opts?: { windowMs?: number; max?: number },
): RateLimitResult {
  const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;
  const max = opts?.max ?? DEFAULT_MAX;
  const key = `${ip}|${route}`;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  if (bucket.count >= max) {
    return { ok: false, retryAfterMs: Math.max(1, bucket.resetAt - now) };
  }

  bucket.count += 1;
  return { ok: true, remaining: max - bucket.count };
}

export function extractClientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "0.0.0.0";
}

export function resetRateLimitForTests(): void {
  buckets.clear();
}
