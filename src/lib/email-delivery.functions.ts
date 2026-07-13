import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHash } from "crypto";
import type { DigestModel } from "./digest";

// KAZEN Email Delivery Foundation — Phase 2 server functions.
//
// Only the Owner can read delivery status or trigger a REAL send, and the only
// real send available in Phase 2 is a founder test to the Owner's OWN verified
// email. No member is ever emailed here. Every write to email_delivery_logs
// stores masked/hashed recipients and safe error text only — never raw
// addresses, tokens, or provider secrets.

async function assertOwner(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}): Promise<void> {
  const { data, error } = await context.supabase.rpc("can_moderate_now", {
    _user_id: context.userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const head = local.slice(0, 1);
  return `${head}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`;
}

function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

const CONTENT_VERSION = "kazen-digest-v2";

// --- Configuration status (Owner-only) ---------------------------------------
export const getEmailDeliveryStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { getEmailConfig } = await import("./email/provider.server");
    const cfg = getEmailConfig();

    // Resolve the Owner's verified email so the console can say whether a test
    // send is possible. We return only a masked address + confirmation flag.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let ownerEmailMasked: string | null = null;
    let ownerEmailConfirmed = false;
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const email = data?.user?.email ?? null;
      if (email) {
        ownerEmailMasked = maskEmail(email);
        ownerEmailConfirmed = Boolean(
          data?.user?.email_confirmed_at || (data?.user as { confirmed_at?: string })?.confirmed_at,
        );
      }
    } catch {
      // ignore — reported as "unknown" below
    }

    return {
      configured: cfg.configured,
      provider: cfg.provider,
      senderLabel: cfg.senderLabel,
      hasAppUrl: cfg.hasAppUrl,
      missing: cfg.missing,
      // Phase 2.1 readiness (safe booleans only — never any value)
      providerKeyConfigured: cfg.providerKeyConfigured,
      senderConfigured: cfg.senderConfigured,
      verifiedSender: cfg.verifiedSender,
      publicUrlConfigured: cfg.publicUrlConfigured,
      unsubSecretConfigured: cfg.unsubSecretConfigured,
      realSendEnabled: cfg.realSendEnabled,
      ownerEmailMasked,
      ownerEmailConfirmed,
      canSendTest: cfg.realSendEnabled && Boolean(ownerEmailMasked) && ownerEmailConfirmed,
    };
  });

// --- Recent delivery history (Owner-only, already-masked columns) -------------
export const getDeliveryHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { data, error } = await context.supabase
      .from("email_delivery_logs")
      .select(
        "id, digest_type, provider, status, recipient_masked, subject, failure_code, failure_message_safe, created_at, sent_at",
      )
      .order("created_at", { ascending: false })
      .limit(15);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// --- Founder test send (Owner-only, to the Owner's own verified email) --------
export const sendFounderTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { variant: "general" | "personalized"; model: DigestModel }) => {
    if (data.variant !== "general" && data.variant !== "personalized") {
      throw new Error("Variante invalide.");
    }
    if (!data.model || !Array.isArray(data.model.sections)) {
      throw new Error("Modèle de digest invalide.");
    }
    return data;
  })
  .handler(async ({ context, data }) => {
    await assertOwner(context);
    const { variant, model } = data;

    const { getEmailConfig, appPublicUrl, sendEmail } = await import("./email/provider.server");
    const cfg = getEmailConfig();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve the Owner's verified email — the ONLY allowed recipient.
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = userData?.user?.email ?? null;
    const confirmed = Boolean(
      userData?.user?.email_confirmed_at ||
        (userData?.user as { confirmed_at?: string })?.confirmed_at,
    );
    if (!email) return { ok: false as const, reason: "no_email" as const };
    if (!confirmed) return { ok: false as const, reason: "email_unconfirmed" as const };

    const digestType = variant === "general" ? "founder_test_general" : "founder_test_personalized";

    // Simple cooldown: refuse if a founder test was attempted in the last 20s.
    const cutoff = new Date(Date.now() - 20_000).toISOString();
    const { count: recent } = await supabaseAdmin
      .from("email_delivery_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .in("digest_type", ["founder_test_general", "founder_test_personalized"])
      .gte("created_at", cutoff);
    if ((recent ?? 0) > 0) return { ok: false as const, reason: "cooldown" as const };

    if (!cfg.realSendEnabled) {
      // Record the skipped attempt so history reflects the readiness gap.
      const notConfigured = !cfg.configured;
      await supabaseAdmin.from("email_delivery_logs").insert({
        user_id: context.userId,
        digest_type: digestType,
        provider: cfg.provider,
        recipient_masked: maskEmail(email),
        recipient_hash: hashEmail(email),
        subject: model.subject,
        status: "skipped",
        failure_code: notConfigured ? "provider_not_configured" : "real_send_disabled",
        failure_message_safe: notConfigured
          ? "Fournisseur d'email non configuré."
          : "Envoi réel désactivé : domaine d'envoi KAZEN non vérifié.",
        content_version: CONTENT_VERSION,
        metadata: { variant, founder_test: true },
      });
      return {
        ok: false as const,
        reason: (notConfigured ? "not_configured" : "real_send_disabled") as
          | "not_configured"
          | "real_send_disabled",
        missing: cfg.missing,
      };
    }

    // Build secure links (encrypted unsubscribe token, no raw ids in URL).
    const { createUnsubToken } = await import("./email/unsub-token.server");
    const scope = variant === "general" ? "general" : "personalized";
    const base = appPublicUrl();
    const unsubscribeUrl = `${base}/desabonnement?token=${encodeURIComponent(
      createUnsubToken(context.userId, scope),
    )}`;
    const manageUrl = `${base}/profil`;

    const { renderDigestEmail } = await import("./email/render-digest");
    const rendered = renderDigestEmail(model, { manageUrl, unsubscribeUrl });

    // Log the attempt first (queued), then update with the outcome.
    const { data: logRow } = await supabaseAdmin
      .from("email_delivery_logs")
      .insert({
        user_id: context.userId,
        digest_type: digestType,
        provider: cfg.provider,
        recipient_masked: maskEmail(email),
        recipient_hash: hashEmail(email),
        subject: rendered.subject,
        status: "queued",
        content_version: CONTENT_VERSION,
        metadata: { variant, founder_test: true },
      })
      .select("id")
      .single();

    const result = await sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    if (logRow?.id) {
      await supabaseAdmin
        .from("email_delivery_logs")
        .update({
          status: result.status,
          provider_message_id: result.id,
          failure_code: result.errorCode,
          failure_message_safe: result.errorMessage,
          sent_at: result.status === "sent" ? result.attemptedAt : null,
        })
        .eq("id", logRow.id);
    }

    return {
      ok: result.ok,
      status: result.status,
      errorMessage: result.errorMessage,
    };
  });
