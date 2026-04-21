/**
 * Substitute {{name}} merge tags in a string using a flat map of values.
 * Unknown names are left as-is (easier to spot during demos than silently empty).
 */
export function substituteMergeTags(input: string, params: Record<string, unknown>): string {
  return input.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => {
    const v = params[name];
    if (v === undefined || v === null) return match;
    return String(v);
  });
}

function substituteContentBlock(
  content: Record<string, unknown>,
  params: Record<string, unknown>,
): Record<string, unknown> {
  const html = content.html;
  if (typeof html !== "string" || html.length === 0) return content;
  const next: Record<string, unknown> = { ...content };
  next.html = substituteMergeTags(html, params);
  if (typeof content.subject === "string") next.subject = substituteMergeTags(content.subject, params);
  if (typeof content.preheader === "string") next.preheader = substituteMergeTags(content.preheader, params);
  return next;
}

/**
 * Dengage's transactional-email API substitutes merge tags ONLY for sends
 * made via content.templateId (its template engine runs). When a caller
 * sends raw content.html, Dengage delivers the HTML verbatim, so
 * {{firstName}} shows up literally in the recipient's inbox.
 *
 * To make portal-baked demo HTML "just work", we do the substitution
 * server-side before the payload reaches Dengage - but only when html
 * is set (i.e. raw-html mode). Template-mode sends are untouched.
 */
export function preSubstituteRawHtmlPayload(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const root = body as Record<string, unknown>;
  const content = root.content;
  if (!content || typeof content !== "object" || Array.isArray(content)) return body;
  const params = root.content && (content as Record<string, unknown>).params;
  if (!params || typeof params !== "object" || Array.isArray(params)) return body;
  return { ...root, content: substituteContentBlock(content as Record<string, unknown>, params as Record<string, unknown>) };
}

/**
 * Bulk-send transform: flat UI -> nested Dengage bulk payload.
 *
 * The UI keeps the bulk form shallow for demo clarity:
 *   recipients (textarea, one per line), templateId, html, subject,
 *   preheader, fromNameId, replyTo, params (k-v), trackOpen/trackClick,
 *   showAllErrors.
 *
 * Dengage's API expects:
 *   {
 *     emailList: [{
 *       content: { templateId?, html?, subject?, preheader?, fromNameId? },
 *       props:   [{ send: { to }, reporting: { trackOpen, trackClick } }, ...],
 *       replyTo?: ...,
 *     }],
 *     showAllErrors: boolean,
 *   }
 *
 * One 'content batch' is built (simplest demo case); each recipient from
 * the textarea becomes a prop with its own send.to. Merge tags in
 * html/subject/preheader are substituted client-side (same as the single
 * send), because Dengage only runs its template engine for templateId sends.
 */
export function transformBulkPayload(flat: unknown): unknown {
  if (!flat || typeof flat !== "object" || Array.isArray(flat)) return flat;
  const f = flat as Record<string, unknown>;

  const recipientsRaw = (f.recipients as string) || "";
  const recipients = recipientsRaw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Build content block
  const content: Record<string, unknown> = {};
  if (typeof f.templateId === "string" && f.templateId) content.templateId = f.templateId;
  if (typeof f.html === "string" && f.html) content.html = f.html;
  if (typeof f.subject === "string" && f.subject) content.subject = f.subject;
  if (typeof f.preheader === "string" && f.preheader) content.preheader = f.preheader;
  if (typeof f.fromNameId === "string" && f.fromNameId) content.fromNameId = f.fromNameId;

  // Substitute merge tags in raw-html mode
  const params = f.params;
  if (params && typeof params === "object" && !Array.isArray(params)) {
    const substituted = substituteContentBlock(content, params as Record<string, unknown>);
    for (const k of Object.keys(substituted)) content[k] = substituted[k];
  }

  // Build props from recipients (one prop per recipient)
  const trackOpen = f.trackOpen !== false;
  const trackClick = f.trackClick === true;
  const props = recipients.map((email) => ({
    send: { to: email },
    reporting: { trackOpen, trackClick },
  }));

  const emailListEntry: Record<string, unknown> = { content, props };
  if (typeof f.replyTo === "string" && f.replyTo) emailListEntry.replyTo = f.replyTo;
  if (typeof f.vmtaId === "string" && f.vmtaId) emailListEntry.vmtaId = f.vmtaId;

  return {
    emailList: [emailListEntry],
    showAllErrors: f.showAllErrors !== false,
  };
}

