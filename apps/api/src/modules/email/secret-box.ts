import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Encryption for credentials the panel stores (mail provider API keys, SMTP
 * passwords).
 *
 * They were written to the database as plain text. Anyone with read access to
 * a backup, a log of a query, or the Supabase dashboard could take the mail
 * account. They are now sealed with AES-256-GCM under a key that lives only in
 * the API's environment (MAIL_ENCRYPTION_KEY), so the database alone is not
 * enough.
 *
 * Format: `enc:v1:<iv>:<tag>:<ciphertext>`, each part base64url. Values without
 * the prefix are treated as legacy plain text and still read, so rows written
 * before this change keep working; they are re-sealed the next time the panel
 * saves them.
 */
const PREFIX = 'enc:v1:';

export class SecretBox {
  private readonly key: Buffer | null;

  constructor(rawKey: string | undefined) {
    const value = rawKey?.trim();
    // Any sufficiently long string works; hashing normalises it to 32 bytes so
    // the variable can be a generated passphrase rather than exact key bytes.
    this.key = value && value.length >= 32 ? createHash('sha256').update(value).digest() : null;
  }

  get configured(): boolean {
    return this.key !== null;
  }

  seal(plain: string): string {
    if (!this.key) throw new Error('MAIL_ENCRYPTION_KEY is not configured.');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${body.toString('base64url')}`;
  }

  /** Plain text for a sealed value; legacy plain values are returned as they are. */
  open(stored: string | null): string | null {
    if (stored === null || !stored.startsWith(PREFIX)) return stored;
    if (!this.key)
      throw new Error('MAIL_ENCRYPTION_KEY is not configured; a sealed credential cannot be read.');
    const [ivRaw, tagRaw, bodyRaw] = stored.slice(PREFIX.length).split(':');
    if (!ivRaw || !tagRaw || bodyRaw === undefined)
      throw new Error('Sealed credential is malformed.');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivRaw, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(bodyRaw, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  static isSealed(value: string | null): boolean {
    return value !== null && value.startsWith(PREFIX);
  }
}
