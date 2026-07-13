// KAZEN provider-agnostic email adapter — Phase 2 (server-only).
//
// Nothing here is ever imported into a client bundle: no provider SDK, no API
// key, no secrets. The concrete provider (Resend) is called over plain HTTPS
// and its response is normalized into a KAZEN-safe SendResult. If the provider
// is not configured, sendEmail resolves { status: "skipped" } instead of
// throwing, so the rest of KAZEN never breaks.

export interface EmailConfig {
  configured: boolean;
  /** Provider name, safe to display (e.g. "Resend"). Null when unconfigured. */
  provider: string | null;
  /** Safe sender label like "KAZEN <notify@domain>". Never includes secrets. */
  senderLabel: string | null;
  hasAppUrl: boolean;
  /** Friendly French names of missing configuration pieces. */
  missing: string[];
}

const PROVIDER_LABEL = "Resend";

/** Read + validate configuration server-side. Never returns any secret value. */
export function getEmailConfig(): EmailConfig {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;
  const displayName = process.env.EMAIL_FROM_NAME || "KAZEN";
  const appUrl = process.env.APP_PUBLIC_URL;

  const missing: string[] = [];
  if (!apiKey) missing.push("clé API du fournisseur");
  if (!from) missing.push("adresse d'expéditeur vérifiée");
  if (!appUrl) missing.push("URL publique de l'application");

  const configured = Boolean(apiKey && from && appUrl);
  return {
    configured,
    provider: apiKey ? PROVIDER_LABEL : null,
    senderLabel: from ? `${displayName} <${from}>` : null,
    hasAppUrl: Boolean(appUrl),
    missing,
  };
}

/** The public app URL, always with a safe fallback. */
export function appPublicUrl(): string {
  return (process.env.APP_PUBLIC_URL || "https://kazen.lovable.app").replace(/\/$/, "");
}

export interface SendResult {
  ok: boolean;
  status: "sent" | "failed" | "skipped";
  id: string | null;
  errorCode: string | null;
  /** Safe, user-facing French message. Never contains provider secrets. */
  errorMessage: string | null;
  attemptedAt: string;
}

function safeProviderMessage(status: number): string {
  if (status === 401 || status === 403)
    return "Le fournisseur a refusé l'authentification. Vérifiez la clé API.";
  if (status === 422)
    return "Le fournisseur a rejeté le message (expéditeur ou destinataire invalide).";
  if (status === 429)
    return "Limite d'envoi du fournisseur atteinte. Réessayez dans un moment.";
  if (status >= 500)
    return "Le fournisseur d'email rencontre un incident. Réessayez plus tard.";
  return "Le fournisseur d'email a renvoyé une erreur.";
}

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send one email through the configured provider. Safe by construction:
 * - unconfigured -> { status: "skipped" } (no throw)
 * - provider 4xx/5xx / timeout -> { status: "failed" } with a safe message
 * - success -> { status: "sent" } with the provider message id
 */
export async function sendEmail(msg: OutboundEmail): Promise<SendResult> {
  const attemptedAt = new Date().toISOString();
  const cfg = getEmailConfig();
  if (!cfg.configured) {
    return {
      ok: false,
      status: "skipped",
      id: null,
      errorCode: "provider_not_configured",
      errorMessage: "Fournisseur d'email non configuré.",
      attemptedAt,
    };
  }

  const apiKey = process.env.RESEND_API_KEY as string;
  const from = process.env.EMAIL_FROM_ADDRESS as string;
  const displayName = process.env.EMAIL_FROM_NAME || "KAZEN";
  const replyTo = process.env.EMAIL_REPLY_TO;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${displayName} <${from}>`,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      // Log status ONLY — never the key, never the full body verbatim.
      console.error(`[email] provider responded ${resp.status}`);
      return {
        ok: false,
        status: "failed",
        id: null,
        errorCode: `provider_${resp.status}`,
        errorMessage: safeProviderMessage(resp.status),
        attemptedAt,
      };
    }

    const data = (await resp.json().catch(() => ({}))) as { id?: string };
    return {
      ok: true,
      status: "sent",
      id: data && data.id ? String(data.id) : null,
      errorCode: null,
      errorMessage: null,
      attemptedAt,
    };
  } catch (err) {
    const isTimeout =
      err != null && typeof err === "object" && (err as { name?: string }).name === "TimeoutError";
    return {
      ok: false,
      status: "failed",
      id: null,
      errorCode: isTimeout ? "provider_timeout" : "provider_unreachable",
      errorMessage: isTimeout
        ? "Délai d'attente dépassé côté fournisseur."
        : "Fournisseur d'email injoignable.",
      attemptedAt,
    };
  }
}
