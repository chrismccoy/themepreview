/**
 * Tests for the WordPress client.
 */

import { describe, it, expect } from "vitest";
import { createApiClient, ApiError } from "../services/api-client.js";

const BASE = "https://wp.example.com/wp-json/themeshowcase/v1";

function respond(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

function clientFor(fetchImpl) {
  return createApiClient({ wpApiBase: BASE, wpTimeoutMs: 50, fetchImpl });
}

const ROW = { id: "aurora", name: "Aurora", category: "Blog", image: "https://wp.example.com/a.png", url: "https://aurora.test" };

describe("createApiClient.fetchThemes", () => {
  it("requests page 1 of the themes route", async () => {
    let seen;
    const client = clientFor(async (url) => {
      seen = url;
      return respond([ROW]);
    });
    await client.fetchThemes();
    expect(seen).toBe(`${BASE}/themes?page=1`);
  });

  it("returns the normalized rows", async () => {
    const client = clientFor(async () => respond([ROW]));
    const result = await client.fetchThemes();
    expect(result.themes).toEqual([ROW]);
  });

  it("throws ApiError carrying the status on a non-2xx response", async () => {
    const client = clientFor(async () => respond({ message: "boom" }, { status: 503 }));
    await expect(client.fetchThemes()).rejects.toMatchObject({ name: "ApiError", status: 503 });
  });

  it("throws when the body is not an array", async () => {
    const client = clientFor(async () => respond({ data: [] }));
    await expect(client.fetchThemes()).rejects.toThrow(/array/i);
  });

  it("drops rows missing an id or a name", async () => {
    const client = clientFor(async () =>
      respond([ROW, { id: "", name: "No id" }, { id: "no-name", name: "" }])
    );
    const { themes } = await client.fetchThemes();
    expect(themes.map((t) => t.id)).toEqual(["aurora"]);
  });

  it("normalizes a missing category to Uncategorized and missing strings to empty", async () => {
    const client = clientFor(async () => respond([{ id: "x", name: "X" }]));
    const { themes } = await client.fetchThemes();
    expect(themes[0]).toEqual({ id: "x", name: "X", category: "Uncategorized", image: "", url: "" });
  });

  it("keeps an http or https demo address", async () => {
    const client = clientFor(async () =>
      respond([
        { id: "a", name: "A", url: "https://a.test" },
        { id: "b", name: "B", url: "http://b.test" },
      ])
    );
    const { themes } = await client.fetchThemes();
    expect(themes.map((t) => t.url)).toEqual(["https://a.test", "http://b.test"]);
  });

  it("drops a javascript: demo address rather than passing it to the browser", async () => {
    const client = clientFor(async () =>
      respond([{ id: "x", name: "X", url: "javascript:window.__pwned=1" }])
    );
    const { themes } = await client.fetchThemes();
    expect(themes[0].url).toBe("");
  });

  it("drops a demo address that is not an absolute URL", async () => {
    const client = clientFor(async () =>
      respond([
        { id: "x", name: "X", url: "not a url" },
        { id: "y", name: "Y", url: "/relative/path" },
      ])
    );
    const { themes } = await client.fetchThemes();
    expect(themes.map((t) => t.url)).toEqual(["", ""]);
  });

  it("reads the total and page count from the WordPress headers", async () => {
    const client = clientFor(async () =>
      respond([ROW], { headers: { "X-WP-Total": "42", "X-WP-TotalPages": "1" } })
    );
    const result = await client.fetchThemes();
    expect(result.total).toBe(42);
    expect(result.pages).toBe(1);
  });

  it("falls back to the row count when the total header is absent", async () => {
    const client = clientFor(async () => respond([ROW]));
    const result = await client.fetchThemes();
    expect(result.total).toBe(1);
  });

  it("reads max-age from Cache-Control as milliseconds", async () => {
    const client = clientFor(async () =>
      respond([ROW], { headers: { "Cache-Control": "public, max-age=300" } })
    );
    const result = await client.fetchThemes();
    expect(result.maxAgeMs).toBe(300_000);
  });

  it("reports a null max-age when Cache-Control is absent", async () => {
    const client = clientFor(async () => respond([ROW]));
    const result = await client.fetchThemes();
    expect(result.maxAgeMs).toBeNull();
  });

  it("aborts the request once the timeout elapses", async () => {
    const client = clientFor((url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason));
      })
    );
    await expect(client.fetchThemes()).rejects.toMatchObject({ name: "TimeoutError" });
  });
});
