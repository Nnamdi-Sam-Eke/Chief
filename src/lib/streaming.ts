export async function streamTextContent(
  fullText: string,
  onChunk: (chunk: string) => void,
  options: { chunkSize?: number; intervalMs?: number } = {},
): Promise<string> {
  const intervalMs = Math.max(0, options.intervalMs ?? 18);

  if (!fullText) {
    onChunk("");
    return "";
  }

  for (let index = 1; index <= fullText.length; index += 1) {
    onChunk(fullText.slice(0, index));
    if (intervalMs > 0 && index < fullText.length) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return fullText;
}
