import assert from "node:assert/strict";
import test from "node:test";
import { GET, POST } from "../app/api/air-math/leaderboard/route.ts";

const route = "https://math-tutor-app-lac.vercel.app/api/air-math/leaderboard";
const entry = {
  name: "Player",
  score: 1700,
  elapsedMs: 15400,
  correctAnswers: 9,
  level: "one-one",
  createdAt: "2026-10-20 01:00:00",
};
const score = { ...entry };
delete score.createdAt;

function post(payload, headers = {}) {
  return new Request(route, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

test("GET preserves scores through only the fixed upstream and no private headers", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(String(url), "https://air-math-pinch-game.zarul47945.chatgpt.site/api/leaderboard?level=one-one");
    assert.equal(options.cache, "no-store");
    assert.equal(options.redirect, "error");
    assert.equal(options.signal instanceof AbortSignal, true);
    assert.deepEqual(options.headers, { Accept: "application/json" });
    return Response.json({ scores: [{ ...entry, internalId: "hidden" }] }, {
      headers: { "set-cookie": "private=value" },
    });
  });
  const response = await GET(new Request(`${route}?level=one-one&upstream=https://example.com`, {
    headers: { cookie: "session=secret", authorization: "Bearer secret" },
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.deepEqual(await response.json(), { scores: [entry] });
});

test("GET rejects invalid or ambiguous levels without making a network request", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => assert.fail("Unexpected network request"));
  for (const query of ["?level=bad", "?level=", "?level=one-one&level=two-two"]) {
    assert.equal((await GET(new Request(`${route}${query}`))).status, 400);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test("POST validates and normalizes a score, forwarding only public fields", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(String(url), "https://air-math-pinch-game.zarul47945.chatgpt.site/api/leaderboard");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), score);
    assert.deepEqual(options.headers, { Accept: "application/json", "Content-Type": "application/json" });
    return Response.json({ entry }, { status: 201 });
  });
  const response = await POST(post({ ...score, name: "  Player  ", admin: true }));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { entry });
});

test("POST rejects malformed objects and impossible round results before network requests", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => assert.fail("Unexpected network request"));
  for (const payload of [
    "null", "[]", "invalid", { ...score, name: "" },
    { ...score, name: "line\nbreak" }, { ...score, name: "a".repeat(19) },
    { ...score, score: -1 }, { ...score, score: 2501 }, { ...score, score: "1700" },
    { ...score, correctAnswers: 2 }, { ...score, correctAnswers: 11 },
    { ...score, elapsedMs: -1 }, { ...score, elapsedMs: 28800001 },
    { ...score, level: "unknown" },
  ]) {
    assert.equal((await POST(post(payload))).status, 400, JSON.stringify(payload));
  }
  assert.equal((await POST(new Request(route, { method: "POST", body: "{}" }))).status, 415);
  assert.equal(fetch.mock.callCount(), 0);
});

test("POST bounds actual streamed UTF-8 bytes with or without Content-Length", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => assert.fail("Unexpected network request"));
  assert.equal((await POST(post("{}", { "content-length": "2049" }))).status, 413);
  assert.equal((await POST(post({ padding: "😀".repeat(600) }))).status, 413);
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(2049)); },
    cancel() { cancelled = true; },
  });
  const request = new Request(route, {
    method: "POST", headers: { "content-type": "application/json" }, body, duplex: "half",
  });
  assert.equal((await POST(request)).status, 413);
  assert.equal(cancelled, true);
  assert.equal(fetch.mock.callCount(), 0);
});

test("upstream failures and malformed responses never reveal server details", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch");
  for (const upstream of [
    new Response("<html>private stack trace</html>", { status: 500 }),
    new Response("<html>private stack trace</html>", { headers: { "content-type": "text/html" } }),
    Response.json({ error: "private database connection string" }),
    Response.json({ scores: [{ ...entry, score: -99 }] }),
    Response.json({ scores: new Array(11).fill(entry) }),
    new Response("x".repeat(65537), { headers: { "content-type": "application/json" } }),
  ]) {
    fetch.mock.mockImplementation(async () => upstream);
    const response = await GET(new Request(route));
    assert.ok(response.status >= 500);
    assert.doesNotMatch(await response.text(), /private|stack|database|connection string/);
  }
  fetch.mock.mockImplementation(async () => { throw new Error("private network details"); });
  assert.equal((await GET(new Request(route))).status, 502);
});

test("timeout returns a safe retryable error", async (t) => {
  t.mock.method(AbortSignal, "timeout", () => AbortSignal.abort());
  t.mock.method(globalThis, "fetch", async () => { throw new DOMException("private", "TimeoutError"); });
  const response = await GET(new Request(route));
  assert.equal(response.status, 504);
  assert.match((await response.json()).error, /too long/);
});
