import { env } from "./env";

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

  // Parse optional cc/bcc lists (same format as recipients: one per line or
  // comma/semicolon separated). V2's enhanced model; safely ignored on V1.
  const ccList = typeof f.cc === "string"
    ? f.cc.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
    : [];
  const bccList = typeof f.bcc === "string"
    ? f.bcc.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
    : [];

  const props = recipients.map((email) => {
    const send: Record<string, unknown> = { to: email };
    if (ccList.length > 0) send.ccList = ccList;
    if (bccList.length > 0) send.bccList = bccList;
    return {
      send,
      reporting: { trackOpen, trackClick },
    };
  });

  const emailListEntry: Record<string, unknown> = { content, props };
  if (typeof f.replyTo === "string" && f.replyTo) emailListEntry.replyTo = f.replyTo;
  if (typeof f.vmtaId === "string" && f.vmtaId) emailListEntry.vmtaId = f.vmtaId;

  return {
    emailList: [emailListEntry],
    showAllErrors: f.showAllErrors !== false,
  };
}

/**
 * Bulk upsert contacts transform: flat UI -> Dengage's nested body.
 *
 * Form is a single-contact form for demo clarity. It's mapped into:
 *   {
 *     columns: [...],           // auto-derived from filled fields
 *     contactDatas: [{ ... }],  // the one contact's data
 *     insertIfNotExists: bool,
 *     throwExceptionIfInvalidRecord: bool,
 *   }
 *
 * For multi-contact bulk calls, reps can switch to Developer view and
 * hand-edit the JSON to include more entries (the API accepts up to
 * 1000 per call).
 */
export function transformContactUpsertPayload(flat: unknown): unknown {
  if (!flat || typeof flat !== "object" || Array.isArray(flat)) return flat;
  const f = flat as Record<string, unknown>;

  // Fields that are part of the contactData row (vs top-level config fields).
  const contactFields = [
    "contact_key",
    "new_contact_key",
    "email",
    "name",
    "surname",
    "gsm",
    "birth_date",
    "gender",
    "subscription_date",
    "email_permission",
    "gsm_permission",
  ];

  const contactData: Record<string, unknown> = {};
  const columns: string[] = [];

  for (const key of contactFields) {
    const v = f[key];
    if (v === undefined || v === "" || v === null) continue;
    contactData[key] = v;
    // contact_key must be listed in columns too - Dengage rejects with
    // 'You must send contact_key in columns' otherwise. Only skip
    // new_contact_key here because it's a rename directive, not a column
    // Dengage can upsert against; include it only when actually present.
    columns.push(key);
  }

  // contact_key is required on each row; if not set, include it as-is so
  // Dengage returns a validation error the rep can actually read.
  if (contactData.contact_key === undefined && typeof f.contact_key === "string") {
    contactData.contact_key = f.contact_key;
  }

  return {
    columns,
    contactDatas: [contactData],
    insertIfNotExists: f.insertIfNotExists !== false,
    throwExceptionIfInvalidRecord: f.throwExceptionIfInvalidRecord !== false,
  };
}

/**
 * UpsertData-Async V2 transform: CSV textarea -> Dengage's documented
 * { tableId | tableName, columns, rows } body.
 *
 * Reps paste CSV (headers on the first row, data rows below) in the form,
 * then the proxy transforms it into the explicit columns + rows arrays
 * the V2 endpoint expects. No base64, no columnMapping - V2 strictly
 * simpler than V1.
 *
 * Basic CSV parsing: splits on commas, trims whitespace. Does NOT handle
 * quoted values with embedded commas - demo scenarios control the CSV
 * shape so this is sufficient; power users can hand-edit the columns/rows
 * arrays directly in Developer view.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Route table-identifier values into tableId vs tableName based on shape.
 * Dengage rejects non-UUID values passed as tableId with a type-conversion
 * error, so a rep typing "product" in the tableId field would break.
 * A UUID-shaped string goes to tableId; anything else goes to tableName.
 */
function routeTableIdentifier(out: Record<string, unknown>, raw: unknown): void {
  if (typeof raw !== "string") return;
  const s = raw.trim();
  if (!s) return;
  if (UUID_RE.test(s)) out.tableId = s;
  else out.tableName = s;
}

export function transformUpsertDataV2Payload(flat: unknown): unknown {
  if (!flat || typeof flat !== "object" || Array.isArray(flat)) return flat;
  const f = flat as Record<string, unknown>;

  const out: Record<string, unknown> = {};
  routeTableIdentifier(out, f.tableId);
  routeTableIdentifier(out, f.tableName);

  const csv = typeof f.csvContent === "string" ? f.csvContent : "";
  if (csv.trim().length > 0) {
    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length > 0) {
      const parseLine = (l: string) => l.split(",").map((c) => c.trim());
      out.columns = parseLine(lines[0]);
      out.rows = lines.slice(1).map(parseLine);
    }
  } else if (Array.isArray(f.columns) && Array.isArray(f.rows)) {
    // Power-user path: user supplied columns/rows directly in JSON editor.
    out.columns = f.columns;
    out.rows = f.rows;
  }

  return out;
}

const PRODUCT_FIELDS = [
  "product_id",
  "title",
  "brand",
  "category_path",
  "description",
  "price",
  "discounted_price",
  "stock_count",
  "link",
  "image_link",
  "small_image_link",
  "large_image_link",
  "mobile_web_link",
  "is_active",
  "publish_date",
];

/**
 * UpsertProduct transform: flat UI for ONE product + variants JSON ->
 * Dengage's { products: [ ... ] } top-level array body.
 *
 * The variants textarea is parsed as JSON (array of variant objects). For
 * multi-product bulk, reps hand-edit the products[] array in Developer view.
 */
export function transformProductsPayload(flat: unknown): unknown {
  if (!flat || typeof flat !== "object" || Array.isArray(flat)) return flat;
  const f = flat as Record<string, unknown>;
  if (Array.isArray(f.products)) return { products: f.products };

  const product: Record<string, unknown> = {};
  for (const key of PRODUCT_FIELDS) {
    const v = f[key];
    if (v === undefined || v === "" || v === null) continue;
    product[key] = v;
  }
  const variants = f.variants;
  if (Array.isArray(variants) && variants.length > 0) product.variants = variants;

  return { products: [product] };
}

const ORDER_FIELDS = [
  "contact_key",
  "order_id",
  "order_date",
  "order_status",
  "item_count",
  "total_amount",
  "order_source",
  "order_source_name",
  "payment_method",
  "coupon_code",
  "referrer",
];

/**
 * UpsertOrders transform: flat UI for ONE order + items JSON ->
 * Dengage's { orders: [ ... ] } top-level array body.
 *
 * The items textarea is parsed as JSON (array of item objects). For
 * multi-order bulk, reps hand-edit the orders[] array in Developer view.
 */
export function transformOrdersPayload(flat: unknown): unknown {
  if (!flat || typeof flat !== "object" || Array.isArray(flat)) return flat;
  const f = flat as Record<string, unknown>;
  if (Array.isArray(f.orders)) return { orders: f.orders };

  const order: Record<string, unknown> = {};
  for (const key of ORDER_FIELDS) {
    const v = f[key];
    if (v === undefined || v === "" || v === null) continue;
    order[key] = v;
  }
  const items = f.items;
  if (Array.isArray(items) && items.length > 0) order.items = items;

  return { orders: [order] };
}

/**
 * Custom event transform: Table Name + attribute-list -> UpsertData V2 body.
 *
 * Attribute rows are { name, type, value }. We coerce the value by type
 * (INTEGER -> parseInt, DECIMAL -> parseFloat, BOOLEAN -> true/false) so
 * Dengage gets the right JSON type on the wire. TEXT/DATE/DATETIME/EMAIL/
 * PHONE go through as strings (Dengage does its own format validation).
 *
 * Empty-named rows are dropped. If no attributes at all are filled, the
 * payload is left without columns/rows so Dengage can respond with a real
 * validation error the rep can see.
 */
function coerceAttributeValue(type: string, raw: string): unknown {
  if (raw === undefined || raw === null) return raw;
  const s = String(raw);
  if (s.length === 0) return s;
  switch ((type || "TEXT").toUpperCase()) {
    case "INTEGER": {
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : s;
    }
    case "DECIMAL": {
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : s;
    }
    case "BOOLEAN": {
      const v = s.trim().toLowerCase();
      if (v === "true") return true;
      if (v === "false") return false;
      return s;
    }
    default:
      return s;
  }
}

export function transformCustomEventPayload(flat: unknown): unknown {
  if (!flat || typeof flat !== "object" || Array.isArray(flat)) return flat;
  const f = flat as Record<string, unknown>;

  // Event API body shape per Dengage docs:
  //   {
  //     accountId,                 // UUID from env (DENGAGE_ACCOUNT_ID)
  //     eventTable,                // big-data table name
  //     key,                       // NAME of the contact-key column (e.g. "key")
  //     eventDetails: {            // all column name -> value pairs (incl. key col)
  //       key: "<contact ID>", event_date: "...", ...,
  //     },
  //   }
  // The endpoint is anonymous (no Bearer token); accountId replaces auth.

  const eventTable =
    (typeof f.tableName === "string" && f.tableName) ||
    (typeof f.tableId === "string" && f.tableId) ||
    "";

  const attrs = Array.isArray(f.attributes)
    ? (f.attributes as Array<{ name?: string; type?: string; value?: string }>)
    : [];
  const eventDetails: Record<string, unknown> = {};
  for (const a of attrs) {
    if (!a || typeof a.name !== "string" || a.name.length === 0) continue;
    eventDetails[a.name] = coerceAttributeValue(a.type || "TEXT", String(a.value ?? ""));
  }

  // 'key' field names which column stores the contact identifier. Default to
  // "key" since Dengage's big-data event tables conventionally have a "key"
  // column (matches every scenario we ship). Let the rep override by
  // including a pseudo-attribute named '__keyColumn' if they need a
  // non-standard name - documented in the notes.
  let keyColumnName = "key";
  if (typeof f.keyColumn === "string" && f.keyColumn) keyColumnName = f.keyColumn;
  else if (typeof eventDetails.__keyColumn === "string") {
    keyColumnName = eventDetails.__keyColumn as string;
    delete eventDetails.__keyColumn;
  }

  let accountId = "";
  try {
    accountId = env.dengageAccountId();
  } catch {
    // Let the server respond with the clear 'Missing DENGAGE_ACCOUNT_ID' text
    // from env.required; body shape below stays consistent for diagnostics.
  }

  return {
    accountId,
    eventTable,
    key: keyColumnName,
    eventDetails,
  };
}

