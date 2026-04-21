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

/**
 * Dengage's transactional-email API substitutes merge tags ONLY for sends
 * made via content.templateId (its template engine runs). When a caller
 * sends raw content.html, Dengage delivers the HTML verbatim, so
 * {{firstName}} shows up literally in the recipient's inbox.
 *
 * To make portal-baked demo HTML "just work", we do the substitution
 * server-side before the payload reaches Dengage - but only when html
 * is set (i.e. raw-html mode). Template-mode sends are untouched.
 *
 * Fields substituted: content.html, content.subject, content.preheader.
 * Keeps content.params in the payload in case Dengage uses it for reports.
 */
export function preSubstituteRawHtmlPayload(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const root = body as Record<string, unknown>;
  const content = root.content;
  if (!content || typeof content !== "object" || Array.isArray(content)) return body;
  const c = content as Record<string, unknown>;

  const html = c.html;
  if (typeof html !== "string" || html.length === 0) return body;

  const params = c.params;
  if (!params || typeof params !== "object" || Array.isArray(params)) return body;
  const p = params as Record<string, unknown>;

  const next: Record<string, unknown> = { ...c };
  next.html = substituteMergeTags(html, p);
  if (typeof c.subject === "string") next.subject = substituteMergeTags(c.subject, p);
  if (typeof c.preheader === "string") next.preheader = substituteMergeTags(c.preheader, p);

  return { ...root, content: next };
}
