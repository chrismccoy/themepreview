/**
 * Tests for the stale while revalidate cache.
 */

import { describe, it, expect, vi } from "vitest";
import { createCache } from "../lib/cache.js";

function clock(start = 1000) {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
}

describe("createCache", () => {
  it("loads on a cold miss and reports the value as fresh", async () => {
    const cache = createCache({ loader: async () => ({ value: "a", ttlMs: 100 }), now: clock().now });
    const hit = await cache.get();
    expect(hit.value).toBe("a");
    expect(hit.stale).toBe(false);
  });

  it("serves from memory inside the ttl without calling the loader again", async () => {
    const loader = vi.fn(async () => ({ value: "a", ttlMs: 100 }));
    const time = clock();
    const cache = createCache({ loader, now: time.now });
    await cache.get();
    time.advance(99);
    const hit = await cache.get();
    expect(hit.value).toBe("a");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("returns the stale value immediately once the ttl has passed", async () => {
    const time = clock();
    let n = 0;
    const cache = createCache({ loader: async () => ({ value: `v${++n}`, ttlMs: 100 }), now: time.now });
    await cache.get();
    time.advance(101);
    const hit = await cache.get();
    expect(hit.value).toBe("v1");
    expect(hit.stale).toBe(true);
  });

  it("refreshes in the background so the next read sees the new value", async () => {
    const time = clock();
    let n = 0;
    const cache = createCache({ loader: async () => ({ value: `v${++n}`, ttlMs: 100 }), now: time.now });
    await cache.get();
    time.advance(101);
    const stale = await cache.get();
    await stale.refresh;
    const fresh = await cache.get();
    expect(fresh.value).toBe("v2");
    expect(fresh.stale).toBe(false);
  });

  it("shares one loader call across concurrent cold misses", async () => {
    const loader = vi.fn(async () => ({ value: "a", ttlMs: 100 }));
    const cache = createCache({ loader, now: clock().now });
    await Promise.all([cache.get(), cache.get(), cache.get()]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("rejects when the loader fails and nothing has ever been cached", async () => {
    const cache = createCache({ loader: async () => { throw new Error("wp down"); }, now: clock().now });
    await expect(cache.get()).rejects.toThrow("wp down");
  });

  it("keeps serving the last good value when a refresh fails", async () => {
    const time = clock();
    let calls = 0;
    const cache = createCache({
      loader: async () => {
        calls += 1;
        if (calls === 1) return { value: "a", ttlMs: 100 };
        throw new Error("wp down");
      },
      now: time.now,
    });
    await cache.get();
    time.advance(101);
    const stale = await cache.get();
    await stale.refresh;
    const after = await cache.get();
    expect(after.value).toBe("a");
    expect(after.stale).toBe(true);
  });

  it("records the refresh failure without throwing out of get", async () => {
    const time = clock();
    let calls = 0;
    const cache = createCache({
      loader: async () => {
        calls += 1;
        if (calls === 1) return { value: "a", ttlMs: 100 };
        throw new Error("wp down");
      },
      now: time.now,
    });
    await cache.get();
    time.advance(101);
    await (await cache.get()).refresh;
    expect(cache.peek().lastError).toMatch(/wp down/);
  });

  it("prefers an explicit ttl override over the one the loader reports", async () => {
    const time = clock();
    const loader = vi.fn(async () => ({ value: "a", ttlMs: 100 }));
    const cache = createCache({ loader, ttlMsOverride: 10, now: time.now });
    await cache.get();
    time.advance(11);
    expect((await cache.get()).stale).toBe(true);
  });

  it("clamps a loader ttl below the floor up to the minimum", async () => {
    const time = clock();
    const cache = createCache({ loader: async () => ({ value: "a", ttlMs: 1 }), minTtlMs: 60_000, now: time.now });
    await cache.get();
    time.advance(59_000);
    expect((await cache.get()).stale).toBe(false);
  });

  it("clamps a loader ttl above the ceiling down to the maximum", async () => {
    const time = clock();
    const cache = createCache({ loader: async () => ({ value: "a", ttlMs: 9_000_000 }), maxTtlMs: 900_000, now: time.now });
    await cache.get();
    time.advance(900_001);
    expect((await cache.get()).stale).toBe(true);
  });

  it("reports the age of the cached value and when it last succeeded", async () => {
    const time = clock();
    const cache = createCache({ loader: async () => ({ value: "a", ttlMs: 100 }), now: time.now });
    await cache.get();
    time.advance(40);
    expect(cache.peek()).toMatchObject({ ageMs: 40, hasValue: true, lastError: null });
  });
});
