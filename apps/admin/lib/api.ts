const API_BASE =
  process.env.NEXT_PUBLIC_ADMIN_API_URL ?? 'http://localhost:4000/api/v1';

export async function adminFetch<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((error as { message: string }).message);
  }

  return res.json() as Promise<T>;
}
