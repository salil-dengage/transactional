import { env } from "./env";
import type { FormSchema, FormValues } from "./form-schema";

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
  /** Path relative to DENGAGE_BASE_URL. */
  path: string;

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

// Dengage DATETIME format per their data-type spec: "YYYY-MM-DD HH:mm" (UTC).
// NOT ISO 8601 - the T separator and Z suffix will be rejected.
function dengageDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}`;
}
function dengageDateTimeDaysAgo(days: number): string {
  return dengageDateTime(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
}
function dengageDateTimeNow(): string {
  return dengageDateTime(new Date());
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
  },

  // 2) TRANSACTIONAL EMAIL REPORT
  //    GET /transactional/email with BeginTime + EndTime returns the report
  //    (emails sent in the window, with delivery / open / click metadata).
  {
    id: "transactional-email-report",
    name: "Transactional Email Report",
    description:
      "Get the list of transactional emails sent in a time window, with delivery, open, click and bounce data per message.",
    category: "reports",
    tags: ["email", "transactional", "analytics"],
    docsUrl: "https://dev.dengage.com/reference/gettransactionalemailreport",
    method: "GET",
    path: "/transactional/email",
    previewKind: "delivery-report",
    form: {
      fields: [
        {
          name: "BeginTime",
          label: "Begin time",
          type: "text",
          required: true,
          placeholder: "YYYY-MM-DD HH:mm",
          help: "Start of the reporting window. Dengage DATETIME format, UTC (e.g. 2026-04-14 00:00).",
        },
        {
          name: "EndTime",
          label: "End time",
          type: "text",
          required: true,
          placeholder: "YYYY-MM-DD HH:mm",
          help: "End of the reporting window. Dengage DATETIME format, UTC.",
        },
      ],
    },
    scenarios: [
      {
        id: "last-24h",
        name: "Last 24 hours",
        values: { BeginTime: dengageDateTimeDaysAgo(1), EndTime: dengageDateTimeNow() },
      },
      {
        id: "last-7d",
        name: "Last 7 days",
        values: { BeginTime: dengageDateTimeDaysAgo(7), EndTime: dengageDateTimeNow() },
      },
      {
        id: "last-30d",
        name: "Last 30 days",
        values: { BeginTime: dengageDateTimeDaysAgo(30), EndTime: dengageDateTimeNow() },
      },
    ],
    defaultPayload: () => ({
      BeginTime: dengageDateTimeDaysAgo(1),
      EndTime: dengageDateTimeNow(),
    }),
    notes: [
      "BeginTime and EndTime are sent as query-string parameters on this GET request.",
      "Dengage's DATETIME format is 'YYYY-MM-DD HH:mm' UTC - not ISO 8601.",
      "If the report is empty, widen the time window with one of the scenarios above.",
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
