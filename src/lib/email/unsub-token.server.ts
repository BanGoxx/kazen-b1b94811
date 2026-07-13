// KAZEN secure unsubscribe token — Phase 2 (server-only).
//
// Purpose-bound, versioned, authenticated-encrypted tokens for one-click
// unsubscribe. AES-256-GCM means the token is BOTH tamper-proof (auth tag) and
// opaque: the raw user id is encrypted, never appearing in plaintext in the
// link. The signing/encryption secret lives only in the server environment
// (EMAIL_UNSUB_SECRET) — never in the database, client bundle, or logs.
//
// No token is ever stored in the database; verification is stateless.

import { createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";

export type UnsubScope = "general" | "personalized" | "all";

const TOKEN_VERSION = 1;

interface TokenPayload {
  v: number;
  uid: string;
  scope: UnsubScope;
  exp: number; // epoch ms
}

/** Derive a stable 32-byte key from the server secret. */
function encryptionKey(): Buffer {
  const secret = process.env.EMAIL_UNSUB_SECRET;
  if (!secret) throw new Error("EMAIL_UNSUB_SECRET is not configured");
  return createHash("sha256").update(secret).digest();
}

/**
 * Create an opaque unsubscribe token. Default validity is generous (90 days)
 * because unsubscribe links must keep working in old emails.
 */
export function createUnsubToken(
  uid: string,
  scope: UnsubScope,
  ttlDays = 90,
): string {
  const payload: TokenPayload = {
    v: TOKEN_VERSION,
    uid,
    scope,
    exp: Date.now() + ttlDays * 24 * 60 * 60 * 1000,
  };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // Layout: iv(12) | tag(16) | ciphertext
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

/**
 * Verify + decrypt a token. Returns null for any tampering, wrong version,
 * expiry, or malformed input — the caller shows a safe error, never a crash.
 */
export function verifyUnsubToken(token: string): TokenPayload | null {
  try {
    if (!token || typeof token !== "string") return null;
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 28) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    const payload = JSON.parse(plaintext) as TokenPayload;
    if (payload.v !== TOKEN_VERSION) return null;
    if (!payload.uid || typeof payload.uid !== "string") return null;
    if (
      payload.scope !== "general" &&
      payload.scope !== "personalized" &&
      payload.scope !== "all"
    )
      return null;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
