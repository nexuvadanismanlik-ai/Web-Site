'use server';

/**
 * Why a sign-in failed, when the panel cannot tell from the answer it got.
 *
 * NextAuth's credentials provider can only say yes or no, so a backend that is
 * unreachable produced exactly the same "no" as a wrong password — and the form
 * told the operator their password was wrong while the API was simply down.
 * That is a lie the panel tells at the worst possible moment: during an outage,
 * to the one person who could fix it.
 *
 * So after a failed sign-in the form asks this, and this asks the API's public
 * health endpoint. Unauthenticated on purpose — it is called by someone who is,
 * by definition, not signed in, and it reveals nothing beyond whether a service
 * that anyone can already probe is answering.
 */
const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';

export async function diagnoseSignInFailure(): Promise<{ apiReachable: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) {
      return { apiReachable: true, message: 'E-posta veya şifre hatalı.' };
    }
    return {
      apiReachable: false,
      message:
        `Sunucuya bağlanılamıyor (HTTP ${res.status}). Şifreniz yanlış olmayabilir — ` +
        'API servisi yanıt vermiyor.',
    };
  } catch {
    return {
      apiReachable: false,
      message:
        'Sunucuya bağlanılamıyor. Şifreniz yanlış olmayabilir — API servisi çalışmıyor ' +
        'ya da uykudan uyanamadı. Birkaç saniye sonra tekrar deneyin.',
    };
  }
}
