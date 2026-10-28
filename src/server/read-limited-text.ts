export class BodyTooLargeError extends Error {
  constructor() {
    super("Body exceeded the configured byte limit.");
    this.name = "BodyTooLargeError";
  }
}

export async function readLimitedText(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<string> {
  if (!body) return "";

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}
