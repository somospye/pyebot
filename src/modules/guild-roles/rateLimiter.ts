
interface BucketState {
  count: number;
  resetAt: number;
  windowMs: number;
  maxUses: number;
}

export interface ConsumeResult {
  allowed: boolean;
  remaining?: number;
  resetAt?: number;
}

const MILLISECONDS_IN_SECOND = 1000;

function isSameConfig(state: BucketState, uses: number, windowMs: number): boolean {
  return state.maxUses === uses && state.windowMs === windowMs;
}

function summarizeKey(key: string): { text: string; action?: string } {
  if (typeof key !== "string") {
    return { text: String(key ?? "") };
  }

  const segments = key.split(":");
  const [, , actionKey] = segments;
  return { text: key, action: actionKey };
}

export class RoleRateLimiter {
  private readonly buckets = new Map<string, BucketState>();
  private readonly lastInvocation = new Map<string, number>();

  consume(key: string, uses: number, windowSeconds: number): ConsumeResult {
    if (uses <= 0 || windowSeconds <= 0) {
      return { allowed: true };
    }

    const windowMs = windowSeconds * MILLISECONDS_IN_SECOND;
    const now = Date.now();

    const existing = this.buckets.get(key);
    let state: BucketState | undefined;

    if (existing && now < existing.resetAt && isSameConfig(existing, uses, windowMs)) {
      state = existing;
    }

    if (!state || now >= state.resetAt) {
      state = {
        count: 0,
        resetAt: now + windowMs,
        windowMs,
        maxUses: uses,
      };
    }

    if (state.count >= uses) {
      this.buckets.set(key, state);
      const info = summarizeKey(key);
      const previous = this.lastInvocation.get(key);
      console.log(
        `[rate-limiter] blocked action=${info.action ?? "unknown"} key=${info.text} remaining=0 lastInvocation=${previous ? new Date(previous).toISOString() : "never"}`,
      );
      return { allowed: false, remaining: 0, resetAt: state.resetAt };
    }

    const previous = this.lastInvocation.get(key);
    state.count += 1;
    this.buckets.set(key, state);
    this.lastInvocation.set(key, now);
    const info = summarizeKey(key);
    console.log(
      `[rate-limiter] consume action=${info.action ?? "unknown"} key=${info.text} remaining=${Math.max(
        0,
        uses - state.count,
      )} lastInvocation=${previous ? new Date(previous).toISOString() : "never"}`,
    );

    return {
      allowed: true,
      remaining: Math.max(0, uses - state.count),
      resetAt: state.resetAt,
    };
  }

  rollback(key: string): void {
    const state = this.buckets.get(key);
    if (!state) return;

    state.count = Math.max(0, state.count - 1);
    if (state.count === 0 && Date.now() >= state.resetAt) {
      this.buckets.delete(key);
    } else {
      this.buckets.set(key, state);
    }
  }
}

export const roleRateLimiter = new RoleRateLimiter();
