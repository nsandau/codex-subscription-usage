import { isEligibleCodexProvider } from "../domain";
import { UsageError } from "./error";
import { normalizeCodexUsage, type UsageSnapshot } from "./normalizer";

export const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const MAX_RESPONSE_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

export interface ActiveCodexAuth {
  provider: string;
  accessToken: string;
  accountId: string;
}

export interface FetchCodexUsageOptions {
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
}

export async function fetchCodexUsage(
  auth: ActiveCodexAuth,
  options: FetchCodexUsageOptions = {},
): Promise<UsageSnapshot> {
  if (!isEligibleCodexProvider(auth.provider) || !auth.accessToken || !auth.accountId || options.signal?.aborted) {
    throw new UsageError();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });

  try {
    const request = new Request(CODEX_USAGE_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "chatgpt-account-id": auth.accountId,
      },
      redirect: "error",
      signal: controller.signal,
    });
    const response = await (options.fetch ?? globalThis.fetch)(request);
    if (!response.ok) throw new UsageError();
    return normalizeCodexUsage(JSON.parse(await readBoundedBody(response)));
  } catch (error) {
    if (error instanceof UsageError) throw error;
    throw new UsageError();
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

async function readBoundedBody(response: Response): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) throw new UsageError();
  if (!response.body) throw new UsageError();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new UsageError();
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}
