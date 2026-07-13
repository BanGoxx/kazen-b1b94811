// KAZEN digest email renderer — Phase 2 (pure, no secrets, no I/O).
//
// Turns a DigestModel into inline-styled, email-client-safe HTML + a plaintext
// alternative. Every interpolated value is HTML-escaped, so digest content can
// never inject markup. The manage-preferences and unsubscribe URLs are passed
// in by the caller (built from a secure token) and override whatever the model
// carried.

import type { DigestModel, DigestSection } from "../digest";

export interface RenderLinks {
  manageUrl: string;
  unsubscribeUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Only allow http(s) URLs into href attributes; anything else falls back to #.
function safeUrl(u: string | null | undefined): string {
  if (!u) return "#";
  const s = String(u).trim();
  if (/^https?:\/\//i.test(s) || s.startsWith("/")) return esc(s);
  return "#";
}

const BG = "#ffffff";
const INK = "#1a1626";
const MUTED = "#6b6577";
const EMBER = "#e0533d";
const BORDER = "#ece9f1";

function mediaRow(section: DigestSection): string {
  const rows = (section.media ?? [])
    .map((m) => {
      const poster = m.posterUrl
        ? `<td width="56" valign="top" style="padding-right:12px;"><img src="${safeUrl(
            m.posterUrl,
          )}" width="56" alt="" style="display:block;border-radius:6px;width:56px;height:auto;" /></td>`
        : "";
      const meta = [m.mediaType, m.releaseDate].filter(Boolean).map(esc).join(" · ");
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;"><tr>${poster}<td valign="top"><a href="${safeUrl(
        m.href,
      )}" style="color:${INK};font-weight:600;text-decoration:none;font-size:15px;">${esc(
        m.title,
      )}</a>${
        meta ? `<div style="color:${MUTED};font-size:12px;margin-top:2px;">${meta}</div>` : ""
      }${
        m.reason
          ? `<div style="color:${MUTED};font-size:12px;margin-top:2px;">${esc(m.reason)}</div>`
          : ""
      }</td></tr></table>`;
    })
    .join("");
  return rows;
}

function articleRow(section: DigestSection): string {
  return (section.articles ?? [])
    .map(
      (a) =>
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;"><tr><td valign="top"><a href="${safeUrl(
          a.href,
        )}" style="color:${INK};font-weight:600;text-decoration:none;font-size:15px;">${esc(
          a.title,
        )}</a><div style="color:${MUTED};font-size:12px;margin-top:2px;">${esc(
          a.excerpt,
        )}</div></td></tr></table>`,
    )
    .join("");
}

function sectionBlock(section: DigestSection): string {
  const body = section.kind === "article" ? articleRow(section) : mediaRow(section);
  if (!body) return "";
  return `<tr><td style="padding:8px 24px 4px;"><h2 style="margin:20px 0 12px;font-size:16px;color:${INK};">${esc(
    section.title,
  )}</h2>${body}</td></tr>`;
}

export function renderDigestEmail(model: DigestModel, links: RenderLinks): RenderedEmail {
  const sections = model.sections.map(sectionBlock).join("");
  const cta = `<tr><td align="center" style="padding:16px 24px 8px;"><a href="${safeUrl(
    model.cta.href,
  )}" style="background:${EMBER};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;display:inline-block;font-size:15px;">${esc(
    model.cta.label,
  )}</a></td></tr>`;

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(
    model.subject,
  )}</title></head><body style="margin:0;padding:0;background:${BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(model.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${BG};border:1px solid ${BORDER};border-radius:14px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="padding:24px 24px 8px;"><div style="font-size:20px;font-weight:800;letter-spacing:1px;color:${EMBER};">KAZEN</div></td></tr>
<tr><td style="padding:8px 24px 0;"><h1 style="margin:0 0 8px;font-size:22px;color:${INK};">${esc(
    model.heading,
  )}</h1><p style="margin:0;color:${MUTED};font-size:14px;line-height:1.5;">${esc(
    model.intro,
  )}</p></td></tr>
${sections}
${cta}
<tr><td style="padding:20px 24px 24px;border-top:1px solid ${BORDER};margin-top:12px;"><p style="margin:0 0 8px;color:${MUTED};font-size:12px;line-height:1.5;">${esc(
    model.footerNote,
  )}</p><p style="margin:0;color:${MUTED};font-size:12px;"><a href="${safeUrl(
    links.manageUrl,
  )}" style="color:${MUTED};">Gérer mes préférences</a> &nbsp;·&nbsp; <a href="${safeUrl(
    links.unsubscribeUrl,
  )}" style="color:${MUTED};">Se désabonner</a></p></td></tr>
</table></td></tr></table></body></html>`;

  const text = renderDigestText(model, links);
  return { subject: model.subject, html, text };
}

function renderDigestText(model: DigestModel, links: RenderLinks): string {
  const lines: string[] = ["KAZEN", "", model.heading, model.intro, ""];
  for (const s of model.sections) {
    const items =
      s.kind === "article"
        ? (s.articles ?? []).map((a) => `- ${a.title} — ${a.href}`)
        : (s.media ?? []).map((m) => `- ${m.title} — ${m.href}`);
    if (!items.length) continue;
    lines.push(s.title.toUpperCase(), ...items, "");
  }
  lines.push(
    `${model.cta.label}: ${model.cta.href}`,
    "",
    model.footerNote,
    `Gérer mes préférences: ${links.manageUrl}`,
    `Se désabonner: ${links.unsubscribeUrl}`,
  );
  return lines.join("\n");
}
