import { env } from "./env";
import type { FormSchema, FormValues } from "./form-schema";
import { preSubstituteRawHtmlPayload, transformBulkPayload } from "./merge-tags";

export type EndpointCategory =
  | "messaging"
  | "audience"
  | "data"
  | "campaigns"
  | "reports"
  | "other";

export const categoryMeta: Record<EndpointCategory, { label: string; blurb: string }> = {
  messaging: {
    label: "Messaging",
    blurb: "Send transactional and promotional messages (email, SMS, push).",
  },
  audience: {
    label: "Audience",
    blurb: "Create and manage contacts, segments, and subscriptions.",
  },
  data: {
    label: "Data",
    blurb: "Import and export data in and out of Dengage.",
  },
  campaigns: {
    label: "Campaigns",
    blurb: "Initiate and control marketing campaigns.",
  },
  reports: {
    label: "Reports",
    blurb: "Pull delivery, engagement, and performance reports.",
  },
  other: {
    label: "Other",
    blurb: "Miscellaneous APIs.",
  },
};

export type PreviewKind = "email" | "template-list" | "delivery-report" | "json";

export interface Scenario {
  id: string;
  name: string;
  description?: string;
  values: FormValues;
}

export interface DengageEndpoint {
  id: string;
  name: string;
  description: string;
  category: EndpointCategory;
  tags?: string[];
  docsUrl?: string;

  method: "GET" | "POST" | "PUT" | "DELETE";
  /** Path relative to baseUrl (or the default DENGAGE_BASE_URL). */
  path: string;
  /** Optional per-endpoint base URL. Use when an endpoint lives on a
   *  different host than the default (e.g. app.dengage.com vs the REST API's
   *  api.dengage.com/rest). */
  baseUrl?: string;

  /**
   * Friendly form schema for the "Functional" view. If omitted, the endpoint
   * only has a Developer (raw JSON) view.
   */
  form?: FormSchema;
  /** Named demo presets; one-click fills the form. */
  scenarios?: Scenario[];
  /** Component key for the Functional-view outcome renderer. */
  previewKind?: PreviewKind;
  /** Starter JSON body shown in Developer view. */
  defaultPayload?: () => unknown;
  /**
   * Optional server-side transform applied to the form payload just before
   * it's sent to Dengage. Use for:
   *   - Flattening a demo-friendly flat form into a nested Dengage shape
   *   - Client-side merge-tag substitution for raw-HTML sends
   * Runs in the proxy route, never in the browser.
   */
  transformPayload?: (payload: unknown) => unknown;
  notes?: string[];
}

// ---------- Endpoint definitions ----------

const defaultRecipient = () => env.defaultDemoRecipient() || "demo@example.com";

// Self-contained HTML emails baked into demo scenarios. Using these means the
// rep can run a live send without first creating a template in Dengage - the
// portal is immediately demo-ready. Merge tags use {{name}} and are passed
// through content.params for Dengage's template engine to substitute.
// (If Dengage doesn't substitute {{tags}} in raw html, the tags will appear
// literally - we can fall back to client-side substitution if that happens.)
const demoHtml = {
  welcome: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f5f6f8;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:32px 12px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
<tr><td style="padding:36px 40px 0;">
<div style="color:#6b7280;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Acme</div>
<h1 style="margin:12px 0 0;color:#111827;font-size:26px;line-height:1.25;">Welcome to Acme, {{firstName}}!</h1>
</td></tr>
<tr><td style="padding:20px 40px 8px;color:#4b5563;font-size:15px;line-height:1.6;">
<p style="margin:0 0 14px;">Thanks for signing up for <strong>{{product}}</strong>. We're thrilled to have you on board.</p>
<p style="margin:0 0 22px;">Here's how to get the most out of your account in the first 5 minutes:</p>
<ol style="margin:0 0 22px;padding-left:20px;color:#4b5563;"><li style="margin-bottom:6px;">Set up your profile</li><li style="margin-bottom:6px;">Invite your teammates</li><li>Connect your first integration</li></ol>
</td></tr>
<tr><td style="padding:0 40px 36px;">
<a href="https://acme.com/welcome" style="display:inline-block;background:#4f46e5;color:#ffffff;padding:12px 22px;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Open your dashboard &rarr;</a>
</td></tr>
<tr><td style="padding:18px 40px;background:#f9fafb;color:#9ca3af;font-size:12px;border-top:1px solid #eef0f3;">Sent via the Dengage Transactional API &middot; showcase portal demo</td></tr>
</table></td></tr></table></body></html>`,

  order: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f5f6f8;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:32px 12px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
<tr><td style="padding:36px 40px 0;">
<div style="color:#6b7280;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Acme Orders</div>
<h1 style="margin:12px 0 0;color:#111827;font-size:24px;line-height:1.3;">Thanks {{firstName}}, your order is confirmed.</h1>
</td></tr>
<tr><td style="padding:20px 40px 8px;color:#4b5563;font-size:15px;line-height:1.6;">
<p style="margin:0 0 20px;">Order <strong style="font-family:Menlo,monospace;background:#f3f4f6;padding:2px 6px;border-radius:3px;">#{{orderId}}</strong> is on its way.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;border:1px solid #e5e7eb;border-radius:8px;">
<tr><td style="padding:14px 16px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e5e7eb;">Summary</td></tr>
<tr><td style="padding:12px 16px;"><table width="100%"><tr><td style="color:#6b7280;font-size:14px;">Total</td><td align="right" style="color:#111827;font-size:14px;font-weight:600;">{{total}}</td></tr><tr><td style="color:#6b7280;font-size:14px;padding-top:4px;">Estimated delivery</td><td align="right" style="color:#111827;font-size:14px;font-weight:600;padding-top:4px;">{{eta}}</td></tr></table></td></tr>
</table>
</td></tr>
<tr><td style="padding:0 40px 36px;">
<a href="https://acme.com/orders/{{orderId}}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 22px;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">View order details &rarr;</a>
</td></tr>
<tr><td style="padding:18px 40px;background:#f9fafb;color:#9ca3af;font-size:12px;border-top:1px solid #eef0f3;">Sent via the Dengage Transactional API &middot; showcase portal demo</td></tr>
</table></td></tr></table></body></html>`,

  passwordReset: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f5f6f8;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:32px 12px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
<tr><td style="padding:36px 40px 0;">
<div style="color:#6b7280;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Acme Security</div>
<h1 style="margin:12px 0 0;color:#111827;font-size:24px;line-height:1.3;">Reset your password</h1>
</td></tr>
<tr><td style="padding:20px 40px 8px;color:#4b5563;font-size:15px;line-height:1.6;">
<p style="margin:0 0 14px;">Hi {{firstName}},</p>
<p style="margin:0 0 14px;">We received a request to reset the password on your Acme account. Click the button below to choose a new one. This link expires in <strong>{{expiresIn}}</strong>.</p>
</td></tr>
<tr><td style="padding:0 40px 18px;">
<a href="{{resetLink}}" style="display:inline-block;background:#dc2626;color:#ffffff;padding:12px 22px;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Reset password &rarr;</a>
</td></tr>
<tr><td style="padding:0 40px 36px;color:#6b7280;font-size:13px;line-height:1.6;">
<p style="margin:0;">If you didn't request this, you can safely ignore this email - your password hasn't changed.</p>
</td></tr>
<tr><td style="padding:18px 40px;background:#f9fafb;color:#9ca3af;font-size:12px;border-top:1px solid #eef0f3;">Sent via the Dengage Transactional API &middot; showcase portal demo</td></tr>
</table></td></tr></table></body></html>`,
};

// Admin-UI datetime format: "YYYY-MM-DDTHH:mm:ss" (no timezone suffix).
// Used by app.dengage.com/api/getTransactionalEmailList.
function dengageIsoStartOfDay(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T00:00:00`;
}
function dengageIsoEndOfDay(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T23:59:59`;
}

export const endpoints: DengageEndpoint[] = [
  // 1) SEND TRANSACTIONAL EMAIL
  {
    id: "send-transactional-email",
    name: "Send Transactional Email",
    description:
      "Send a single transactional email using a pre-configured Dengage template. Use for order confirmations, password resets, receipts, etc.",
    category: "messaging",
    tags: ["email", "transactional"],
    docsUrl: "https://dev.dengage.com/reference/sendtransactionalemail",
    method: "POST",
    // GET and POST on the same resource: GET /transactional/email returns the
    // report; POST /transactional/email sends a new transactional email.
    path: "/transactional/email",
    previewKind: "email",
    form: {
      // Flat UI; nested JSON per Dengage SDK spec. Structure:
      //   send:     { to, cc, bcc }
      //   content:  { templateId, subject, fromNameId, preheader, params? }
      //   reporting:{ trackOpen, trackClick }
      //   replyTo is top-level
      fields: [
        {
          name: "to",
          label: "Recipient email",
          type: "email",
          required: true,
          default: defaultRecipient(),
          payloadPath: "send.to",
          help: "Where the email will be delivered. Uses DEFAULT_DEMO_RECIPIENT by default.",
        },
        {
          name: "templateId",
          label: "Template ID",
          type: "text",
          required: true,
          placeholder: "e.g. 7bb82200-1cd0-4b4e-92fa-a19545d208b7",
          payloadPath: "content.templateId",
          help: "Copy the template ID from the Dengage UI (Transactional > Templates).",
        },
        {
          name: "fromNameId",
          label: "From-name ID (optional)",
          type: "text",
          placeholder: "UUID from Dengage > Senders",
          payloadPath: "content.fromNameId",
          help: "Dengage expects an ID, not a free-text name. Leave empty to use the template's default sender.",
        },
        {
          name: "subject",
          label: "Subject (optional override)",
          type: "text",
          placeholder: "Leave empty to use the template's subject",
          payloadPath: "content.subject",
        },
        {
          name: "preheader",
          label: "Preheader (optional)",
          type: "text",
          placeholder: "Short teaser shown next to the subject in many inboxes",
          payloadPath: "content.preheader",
        },
        {
          name: "html",
          label: "HTML body (optional)",
          type: "textarea",
          placeholder: "Leave empty when using a Template ID. Scenarios pre-fill this with demo HTML.",
          payloadPath: "content.html",
          help: "Dengage requires content.templateId OR content.html. Use scenarios below to get ready-made HTML, or paste your own.",
        },
        {
          name: "params",
          label: "Personalization variables",
          type: "key-value",
          keyLabel: "Variable name",
          valueLabel: "Value",
          payloadPath: "content.params",
          help: "Key-value pairs for template merge tags. The field name (content.params) isn't in the public SDK spec - if your template expects a different name (e.g. content.bodyParams) edit in Developer view.",
          default: { firstName: "Salil" },
        },
        {
          name: "cc",
          label: "CC (optional)",
          type: "email",
          placeholder: "cc@example.com",
          payloadPath: "send.cc",
        },
        {
          name: "bcc",
          label: "BCC (optional)",
          type: "email",
          placeholder: "bcc@example.com",
          payloadPath: "send.bcc",
        },
        {
          name: "replyTo",
          label: "Reply-To (optional)",
          type: "email",
          placeholder: "reply@example.com",
          payloadPath: "replyTo",
        },
        {
          name: "trackOpen",
          label: "Track opens",
          type: "boolean",
          payloadPath: "reporting.trackOpen",
          default: true,
          help: "Dengage reports when the recipient opens the email.",
        },
        {
          name: "trackClick",
          label: "Track clicks",
          type: "boolean",
          payloadPath: "reporting.trackClick",
          default: false,
          help: "Dengage rewrites links to capture click-through events.",
        },
      ],
    },
    scenarios: [
      {
        id: "welcome",
        name: "Welcome email",
        description: "New user just signed up.",
        values: {
          to: defaultRecipient(),
          subject: "Welcome to Acme, {{firstName}}!",
          preheader: "Here's everything you need to get started.",
          html: demoHtml.welcome,
          params: { firstName: "Salil", product: "Acme Pro" },
          trackOpen: true,
          trackClick: true,
        },
      },
      {
        id: "order-confirmation",
        name: "Order confirmation",
        description: "Customer just placed an order.",
        values: {
          to: defaultRecipient(),
          subject: "Your order #A-10042 is confirmed",
          preheader: "Estimated delivery: 3-5 business days",
          html: demoHtml.order,
          params: {
            firstName: "Salil",
            orderId: "A-10042",
            total: "$129.00",
            eta: "3-5 business days",
          },
          trackOpen: true,
          trackClick: true,
        },
      },
      {
        id: "password-reset",
        name: "Password reset",
        description: "User requested a password reset link.",
        values: {
          to: defaultRecipient(),
          subject: "Reset your Acme password",
          preheader: "This link expires in 30 minutes.",
          html: demoHtml.passwordReset,
          params: {
            firstName: "Salil",
            resetLink: "https://acme.com/reset?token=demo-token-abcxyz",
            expiresIn: "30 minutes",
          },
          trackOpen: true,
          trackClick: false,
        },
      },
    ],
    defaultPayload: () => ({
      send: { to: defaultRecipient() },
      content: {
        templateId: "REPLACE_WITH_TEMPLATE_ID",
        subject: "Hello from the Dengage showcase portal",
        preheader: "A quick note from the showcase portal.",
        params: { firstName: "Prospect" },
      },
      reporting: { trackOpen: true, trackClick: false },
    }),
    notes: [
      "Template ID is required. Scenarios don't set it - enter yours in the Template ID field first, then click a scenario to fill in subject/variables/etc. around it.",
      "Without a templateId, Dengage requires content.html instead (raw HTML body) and will reject with 'Html content must be filled'.",
      "Body is nested - send{}, content{}, reporting{}, with replyTo at the top level. The form is flat for demo clarity; the JSON in Developer view is what Dengage actually receives.",
      "content.fromNameId is a UUID from your Senders config, not a free-text From name. Leave blank to use the template's default sender.",
      "If Dengage rejects 'content.params' in your workspace, adjust the key in Developer view - not all workspaces use the same merge-variable field name.",
    ],
    transformPayload: preSubstituteRawHtmlPayload,
  },

  // 1b) SEND TRANSACTIONAL BULK EMAIL (V2)
  {
    id: "send-transactional-bulk-email",
    name: "Send Transactional Bulk Email (V2)",
    description:
      "Send one content block to many recipients in a single call. V2 adds multi-recipient CC/BCC lists with per-address tracking in the response. Up to 50 content batches per request and up to 100 recipients per batch.",
    category: "messaging",
    tags: ["email", "transactional", "bulk", "v2"],
    docsUrl: "https://dev.dengage.com/reference/sendtransactionalbulkemailv2",
    method: "POST",
    path: "/transactional/email/bulkV2",
    previewKind: "email",
    form: {
      // Flat form; transformed into Dengage's nested emailList[].props[] shape
      // server-side by transformBulkPayload.
      fields: [
        {
          name: "recipients",
          label: "Recipients (To)",
          type: "textarea",
          required: true,
          placeholder: "one@example.com\ntwo@example.com\nthree@example.com",
          help: "One email per line (or comma / semicolon separated). Up to 100 per batch.",
          default: defaultRecipient(),
        },
        {
          name: "cc",
          label: "CC list (optional)",
          type: "textarea",
          placeholder: "manager@example.com\nops@example.com",
          help: "V2 feature: send one email with multiple CCs. One per line (or comma-separated). Applied to every recipient.",
        },
        {
          name: "bcc",
          label: "BCC list (optional)",
          type: "textarea",
          placeholder: "audit@example.com",
          help: "V2 feature: multiple BCCs with per-address tracking in the response.",
        },
        {
          name: "templateId",
          label: "Template ID (optional)",
          type: "text",
          placeholder: "UUID from Dengage > Transactional > Templates",
          help: "Provide this OR an HTML body. If both are set, Dengage uses the template.",
        },
        {
          name: "fromNameId",
          label: "From-name ID (optional)",
          type: "text",
          placeholder: "UUID from Dengage > Senders",
        },
        {
          name: "subject",
          label: "Subject",
          type: "text",
          placeholder: "Applies to all recipients in this batch",
        },
        {
          name: "preheader",
          label: "Preheader (optional)",
          type: "text",
        },
        {
          name: "html",
          label: "HTML body (optional)",
          type: "textarea",
          placeholder: "Leave empty if using a Template ID. Scenarios pre-fill this.",
          help: "Dengage needs templateId OR html. Scenarios load ready-made HTML.",
        },
        {
          name: "params",
          label: "Personalization variables",
          type: "key-value",
          keyLabel: "Variable name",
          valueLabel: "Value",
          help: "Applied to all recipients. For raw-HTML sends the portal substitutes {{tags}} before dispatch (shared across recipients).",
          default: { firstName: "there" },
        },
        {
          name: "replyTo",
          label: "Reply-To (optional)",
          type: "email",
          placeholder: "reply@example.com",
        },
        {
          name: "trackOpen",
          label: "Track opens",
          type: "boolean",
          default: true,
        },
        {
          name: "trackClick",
          label: "Track clicks",
          type: "boolean",
          default: false,
        },
        {
          name: "showAllErrors",
          label: "Return all per-recipient errors",
          type: "boolean",
          default: true,
          help: "When true, Dengage surfaces failures for every recipient; otherwise only the first.",
        },
      ],
    },
    scenarios: [
      {
        id: "welcome-bulk",
        name: "Welcome - 3 new signups",
        description: "Same welcome email to three recipients.",
        values: {
          recipients: [defaultRecipient(), defaultRecipient().replace("@", "+alice@"), defaultRecipient().replace("@", "+bob@")].join("\n"),
          subject: "Welcome to Acme, {{firstName}}!",
          preheader: "Here's everything you need to get started.",
          html: demoHtml.welcome,
          params: { firstName: "there", product: "Acme Pro" },
          trackOpen: true,
          trackClick: true,
          showAllErrors: true,
        },
      },
      {
        id: "order-batch",
        name: "Order dispatch digest",
        description: "Three customers whose orders just shipped.",
        values: {
          recipients: [defaultRecipient(), defaultRecipient().replace("@", "+customer2@"), defaultRecipient().replace("@", "+customer3@")].join("\n"),
          subject: "Your order #A-10042 has shipped",
          preheader: "Track it in your dashboard.",
          html: demoHtml.order,
          params: {
            firstName: "there",
            orderId: "A-10042",
            total: "$129.00",
            eta: "3-5 business days",
          },
          trackOpen: true,
          trackClick: true,
          showAllErrors: true,
        },
      },
      {
        id: "reset-batch",
        name: "Password-reset batch",
        description: "Multiple recipients, same reset flow.",
        values: {
          recipients: [defaultRecipient(), defaultRecipient().replace("@", "+reset1@"), defaultRecipient().replace("@", "+reset2@")].join("\n"),
          subject: "Reset your Acme password",
          preheader: "This link expires in 30 minutes.",
          html: demoHtml.passwordReset,
          params: {
            firstName: "there",
            resetLink: "https://acme.com/reset?token=demo-token-abcxyz",
            expiresIn: "30 minutes",
          },
          trackOpen: true,
          trackClick: false,
          showAllErrors: true,
        },
      },
    ],
    defaultPayload: () => ({
      emailList: [
        {
          content: {
            templateId: "REPLACE_WITH_TEMPLATE_ID",
            subject: "Hello from the Dengage showcase portal",
            preheader: "A quick note from the bulk-send demo.",
          },
          props: [
            {
              send: {
                to: defaultRecipient(),
                ccList: ["manager@example.com"],
              },
              reporting: { trackOpen: true, trackClick: false },
            },
            {
              send: { to: defaultRecipient().replace("@", "+2@") },
              reporting: { trackOpen: true, trackClick: false },
            },
          ],
        },
      ],
      showAllErrors: true,
    }),
    notes: [
      "Endpoint is V2: same request structure as V1 with added support for multi-CC / multi-BCC (ccList / bccList arrays) and per-address tracking in the response.",
      "The form is flat for demo clarity; the portal builds Dengage's nested emailList[].props[] shape server-side. Switch to Developer view to see the exact JSON that was sent.",
      "One content batch per request in this form (simplest case). To demo multiple different contents in one call, hand-edit the JSON in Developer view.",
      "Raw-HTML sends share one rendered body across all recipients (same merge-tag values). For per-recipient personalization, use a Dengage templateId - Dengage's engine does that per-send.",
      "Response returns one groupId per content batch and per-address tracking IDs for every To/CC/BCC - useful for correlating subsequent report queries.",
    ],
    transformPayload: transformBulkPayload,
  },

  // 2) TRANSACTIONAL EMAIL SEND LOGS
  //    Admin-UI API powering the 'Analytics > Send Logs' page. POST to
  //    app.dengage.com/api/getTransactionalEmailList with a JSON body.
  //    Different base host than the REST API; handled via endpoint.baseUrl.
  {
    id: "transactional-email-report",
    name: "Transactional Email Send Logs",
    description:
      "List transactional emails sent in a time window with delivery, open, click and bounce data per message. Mirrors Dengage Analytics > Send Logs and accepts an optional recipient-email filter.",
    category: "reports",
    tags: ["email", "transactional", "analytics", "admin-ui"],
    docsUrl: "https://dev.dengage.com/reference/gettransactionalemailreport",
    method: "POST",
    baseUrl: "https://app.dengage.com",
    path: "/api/getTransactionalEmailList",
    previewKind: "delivery-report",
    form: {
      fields: [
        {
          name: "email",
          label: "Recipient email (optional)",
          type: "email",
          placeholder: "Leave empty to list all sends in the window",
          help: "Filter to sends delivered to a specific address.",
        },
        {
          name: "startDate",
          label: "Start date",
          type: "text",
          required: true,
          placeholder: "YYYY-MM-DDTHH:mm:ss",
          help: "ISO-like datetime, no timezone suffix (e.g. 2026-04-21T00:00:00).",
        },
        {
          name: "endDate",
          label: "End date",
          type: "text",
          required: true,
          placeholder: "YYYY-MM-DDTHH:mm:ss",
        },
        {
          name: "tagId",
          label: "Tag ID",
          type: "number",
          default: 0,
          help: "0 = all tags. Set to a specific tag ID to filter.",
        },
        {
          name: "limit",
          label: "Limit",
          type: "number",
          default: 50,
          help: "Max rows to return.",
        },
        {
          name: "offset",
          label: "Offset",
          type: "number",
          default: 0,
          help: "Skip N rows (pagination).",
        },
      ],
    },
    scenarios: [
      {
        id: "today-salil",
        name: "Today - to salil.gupta",
        description: "Sends delivered to the default demo recipient today.",
        values: {
          email: defaultRecipient(),
          startDate: dengageIsoStartOfDay(0),
          endDate: dengageIsoEndOfDay(0),
          tagId: 0,
          limit: 50,
          offset: 0,
        },
      },
      {
        id: "today-all",
        name: "Today - all recipients",
        values: {
          email: "",
          startDate: dengageIsoStartOfDay(0),
          endDate: dengageIsoEndOfDay(0),
          tagId: 0,
          limit: 50,
          offset: 0,
        },
      },
      {
        id: "last-7d-all",
        name: "Last 7 days",
        values: {
          email: "",
          startDate: dengageIsoStartOfDay(7),
          endDate: dengageIsoEndOfDay(0),
          tagId: 0,
          limit: 50,
          offset: 0,
        },
      },
    ],
    defaultPayload: () => ({
      email: defaultRecipient(),
      startDate: dengageIsoStartOfDay(0),
      endDate: dengageIsoEndOfDay(0),
      startTime: null,
      endTime: null,
      tagId: 0,
      limit: 50,
      offset: 0,
    }),
    transformPayload: (flat) => {
      if (!flat || typeof flat !== "object" || Array.isArray(flat)) return flat;
      const f = flat as Record<string, unknown>;
      const out: Record<string, unknown> = { ...f };
      // The admin UI always sends startTime/endTime: null - include them so
      // Dengage doesn't reject on unexpected missing fields.
      if (out.startTime === undefined) out.startTime = null;
      if (out.endTime === undefined) out.endTime = null;
      // Coerce empty-string email to undefined so Dengage treats it as 'all'.
      if (out.email === "" || out.email === undefined) delete out.email;
      return out;
    },
    notes: [
      "This endpoint lives on app.dengage.com (Dengage's admin-UI API), not api.dengage.com/rest - the portal routes it to the right host automatically.",
      "Auth uses the same Bearer token as the REST API. If you get 401/Guest, Dengage issued the admin-UI domain a different token and we'll need a separate login flow.",
      "Dates are 'YYYY-MM-DDTHH:mm:ss' with no timezone suffix (note the T separator). Scenarios wire this up automatically.",
      "tagId=0 means 'all tags'. limit/offset paginate.",
    ],
  },
];

export function getEndpoint(id: string): DengageEndpoint | undefined {
  return endpoints.find((e) => e.id === id);
}

export function endpointsByCategory(): Record<EndpointCategory, DengageEndpoint[]> {
  const out: Record<EndpointCategory, DengageEndpoint[]> = {
    messaging: [],
    audience: [],
    data: [],
    campaigns: [],
    reports: [],
    other: [],
  };
  for (const e of endpoints) out[e.category].push(e);
  return out;
}
