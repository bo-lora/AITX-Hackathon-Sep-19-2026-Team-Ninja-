const DEFAULT_ENGINE = "http://127.0.0.1:4710";

export function engineOrigin(): string {
  const raw = process.env.OPENEMR_ENGINE_URL || DEFAULT_ENGINE;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("OPENEMR_ENGINE_URL is not a valid URL.");
  }
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error("Intake engine URL must be local.");
  }
  return url.origin;
}

export function engineReviewUrl(): string {
  return `${engineOrigin()}/review/latest`;
}

export async function engineFetch(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const { timeoutMs = 180_000, ...rest } = init ?? {};
  const url = `${engineOrigin()}${path}`;
  try {
    return await fetch(url, {
      ...rest,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Intake engine is not reachable at ${engineOrigin()} (${detail}). From the repo root: npm start --prefix packages/engine`,
    );
  }
}
