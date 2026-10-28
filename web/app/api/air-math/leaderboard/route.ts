export const dynamic = "force-dynamic";

const UPSTREAM =
  "https://air-math-pinch-game.zarul47945.chatgpt.site/api/leaderboard";
const VALID_LEVELS = new Set(["one-one", "one-two", "two-two", "sifir-1-5", "sifir-2-12"]);
const MAX_BODY_BYTES = 2048;
const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_SCORE = 2500;
const MAX_ELAPSED_MS = 8 * 60 * 60 * 1000;

type Score = {
  name: string;
  score: number;
  elapsedMs: number;
  correctAnswers: number;
  level: string;
};

class RequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validScore(
  value: Record<string, unknown>,
): value is Record<string, unknown> & Score {
  return (
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    Array.from(value.name).length <= 18 &&
    !/[\u0000-\u001f\u007f]/u.test(value.name) &&
    Number.isSafeInteger(value.score) &&
    Number(value.score) >= 0 &&
    Number(value.score) <= MAX_SCORE &&
    Number.isSafeInteger(value.elapsedMs) &&
    Number(value.elapsedMs) >= 0 &&
    Number(value.elapsedMs) <= MAX_ELAPSED_MS &&
    Number.isInteger(value.correctAnswers) &&
    Number(value.correctAnswers) >= 0 &&
    Number(value.correctAnswers) <= 10 &&
    Number(value.score) <= Number(value.correctAnswers) * 250 &&
    typeof value.level === "string" &&
    VALID_LEVELS.has(value.level)
  );
}

// Limit actual streamed bytes as Content-Length can be missing or incorrect.
async function readBoundedBody(
  source: Request | Response,
  limit: number,
): Promise<string> {
  if (Number(source.headers.get("content-length")) > limit) {
    throw new RequestError("Score entry is too large.", 413);
  }
  if (!source.body) return "";

  const reader = source.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => {});
        throw new RequestError("Score entry is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new RequestError("Score entry must be valid JSON.", 400);
  }
}

function publicEntry(value: unknown): (Score & { createdAt: string }) | null {
  if (
    !isRecord(value) ||
    !validScore(value) ||
    typeof value.createdAt !== "string" ||
    value.createdAt.length > 64
  ) {
    return null;
  }
  return {
    name: value.name,
    score: value.score,
    elapsedMs: value.elapsedMs,
    correctAnswers: value.correctAnswers,
    level: value.level,
    createdAt: value.createdAt,
  };
}

async function forward(url: URL, score?: Score) {
  const signal = AbortSignal.timeout(10_000);
  try {
    // The fixed destination shares existing scores; no player cookies or auth
    // headers are sent to the leaderboard service.
    const response = await fetch(url, {
      method: score ? "POST" : "GET",
      headers: score
        ? { Accept: "application/json", "Content-Type": "application/json" }
        : { Accept: "application/json" },
      body: score ? JSON.stringify(score) : undefined,
      cache: "no-store",
      redirect: "error",
      signal,
    });

    if (!response.ok) {
      const status = response.status >= 400 ? response.status : 502;
      return json(
        {
          error:
            status === 429
              ? "Too many score requests. Please try again shortly."
              : "The leaderboard is temporarily unavailable. Please try again shortly.",
        },
        status,
      );
    }
    if (
      response.headers.get("content-type")?.split(";", 1)[0].trim() !==
      "application/json"
    ) {
      throw new Error("Invalid leaderboard response.");
    }

    const data: unknown = JSON.parse(
      await readBoundedBody(response, MAX_RESPONSE_BYTES),
    );
    if (!isRecord(data)) throw new Error("Invalid leaderboard response.");

    if (score) {
      const entry = publicEntry(data.entry);
      if (!entry) throw new Error("Invalid leaderboard response.");
      return json({ entry }, response.status);
    }

    if (!Array.isArray(data.scores) || data.scores.length > 10) {
      throw new Error("Invalid leaderboard response.");
    }
    const scores = data.scores.map(publicEntry);
    if (scores.some((entry) => entry === null)) {
      throw new Error("Invalid leaderboard response.");
    }
    return json({ scores }, response.status);
  } catch {
    return json(
      {
        error: signal.aborted
          ? "The leaderboard took too long to respond. Please try again."
          : "The leaderboard is temporarily unavailable. Please try again shortly.",
      },
      signal.aborted ? 504 : 502,
    );
  }
}

export async function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const levels = parameters.getAll("level");
  if (levels.length > 1 || (levels.length === 1 && !VALID_LEVELS.has(levels[0]))) {
    return json({ error: "Choose a valid game level." }, 400);
  }
  const upstream = new URL(UPSTREAM);
  if (levels.length === 1) upstream.searchParams.set("level", levels[0]);
  return forward(upstream);
}

export async function POST(request: Request) {
  try {
    if (
      request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !==
      "application/json"
    ) {
      return json({ error: "Score entry must be valid JSON." }, 415);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(await readBoundedBody(request, MAX_BODY_BYTES));
    } catch (error) {
      if (error instanceof RequestError) throw error;
      throw new RequestError("Score entry must be valid JSON.", 400);
    }
    if (!isRecord(payload)) {
      return json({ error: "Score entry must be a JSON object." }, 400);
    }
    if (typeof payload.name === "string") {
      payload.name = payload.name.normalize("NFC").trim();
    }
    if (!validScore(payload)) {
      return json({ error: "Enter a valid nickname and round result." }, 400);
    }

    return forward(new URL(UPSTREAM), {
      name: payload.name,
      score: payload.score,
      elapsedMs: payload.elapsedMs,
      correctAnswers: payload.correctAnswers,
      level: payload.level,
    });
  } catch (error) {
    return json(
      { error: error instanceof RequestError ? error.message : "Unable to read this score entry." },
      error instanceof RequestError ? error.status : 400,
    );
  }
}
