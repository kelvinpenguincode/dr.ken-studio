/** Safely parse a fetch Response body as JSON (empty body → null). */
export async function readResponseJson<T = unknown>(
  response: Response,
): Promise<T | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function errorFromResponse(
  data: { error?: string } | null,
  fallback: string,
  status?: number,
): string {
  if (data?.error) return data.error;
  if (status === 404) return "API route not found — redeploy may still be in progress";
  if (status && status >= 500) {
    return `${fallback} (server ${status}). If you just updated admins, run npx prisma db push.`;
  }
  return fallback;
}
