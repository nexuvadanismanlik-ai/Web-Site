const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((error as { message: string }).message);
  }

  return res.json() as Promise<T>;
}

export async function resolveTenant(domain: string) {
  return apiFetch<{ success: boolean; data: unknown }>(`/tenant/resolve?domain=${encodeURIComponent(domain)}`);
}
