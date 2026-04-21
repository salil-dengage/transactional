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

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}
function isoNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
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
    path: "/sendtransactionalemail",
    previewKind: "email",
    form: {
      fields: [
        {
          name: "to",
          label: "Recipient email",
          type: "email",
          required: true,
          default: defaultRecipient(),
          help: "Where the email will be delivered. Uses DEFAULT_DEMO_RECIPIENT by default.",
        },
        {
          name: "templateId",
          label: "Template ID",
          type: "text",
          required: true,
          placeholder: "e.g. 12345",
          help: "Copy the template ID from the Dengage UI (Transactional > Templates).",
        },
        {
          name: "fromName",
          label: "From name (optional)",
          type: "text",
          placeholder: "e.g. Acme Support",
        },
        {
          name: "fromEmail",
          label: "From email (optional)",
          type: "email",
          placeholder: "e.g. no-reply@acme.com",
        },
        {
          name: "subject",
          label: "Subject (optional override)",
          type: "text",
          placeholder: "Leave empty to use the template's subject",
        },
        {
          name: "params",
          label: "Personalization variables",
          type: "key-value",
          keyLabel: "Variable name",
          valueLabel: "Value",
          help: "Key-value pairs passed to the template (e.g. firstName = Salil).",
          default: { firstName: "Salil" },
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
          fromName: "Acme",
          fromEmail: "welcome@acme.com",
          subject: "Welcome to Acme, {{firstName}}!",
          params: { firstName: "Salil", product: "Acme Pro" },
        },
      },
      {
        id: "order-confirmation",
        name: "Order confirmation",
        description: "Customer just placed an order.",
        values: {
          to: defaultRecipient(),
          fromName: "Acme Orders",
          fromEmail: "orders@acme.com",
          subject: "Your order #A-10042 is confirmed",
          params: {
            firstName: "Salil",
            orderId: "A-10042",
            total: "$129.00",
            eta: "3-5 business days",
          },
        },
      },
      {
        id: "password-reset",
        name: "Password reset",
        description: "User requested a password reset link.",
        values: {
          to: defaultRecipient(),
          fromName: "Acme Security",
          fromEmail: "security@acme.com",
          subject: "Reset your Acme password",
          params: {
            firstName: "Salil",
            resetLink: "https://acme.com/reset?token=demo-token-abcxyz",
            expiresIn: "30 minutes",
          },
        },
      },
    ],
    defaultPayload: () => ({
      to: defaultRecipient(),
      templateId: "REPLACE_WITH_TEMPLATE_ID",
      subject: "Hello from the Dengage showcase portal",
      fromName: "Dengage Demo",
      fromEmail: "no-reply@yourdomain.com",
      params: { firstName: "Prospect" },
    }),
    notes: [
      "Grab the templateId from the Dengage UI under Transactional > Templates and paste it into the field.",
      "Keys under 'Personalization variables' are passed into your template's merge tags.",
      "If Dengage rejects a field name, open Developer view and adjust the JSON directly - the portal sends exactly what you see.",
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
          placeholder: "YYYY-MM-DDTHH:mm:ssZ",
          help: "Start of the reporting window. ISO 8601 UTC (e.g. 2026-04-14T00:00:00Z).",
        },
        {
          name: "EndTime",
          label: "End time",
          type: "text",
          required: true,
          placeholder: "YYYY-MM-DDTHH:mm:ssZ",
          help: "End of the reporting window. ISO 8601 UTC.",
        },
      ],
    },
    scenarios: [
      {
        id: "last-24h",
        name: "Last 24 hours",
        values: { BeginTime: isoDaysAgo(1), EndTime: isoNow() },
      },
      {
        id: "last-7d",
        name: "Last 7 days",
        values: { BeginTime: isoDaysAgo(7), EndTime: isoNow() },
      },
      {
        id: "last-30d",
        name: "Last 30 days",
        values: { BeginTime: isoDaysAgo(30), EndTime: isoNow() },
      },
    ],
    defaultPayload: () => ({ BeginTime: isoDaysAgo(1), EndTime: isoNow() }),
    notes: [
      "BeginTime and EndTime are sent as query-string parameters on this GET request.",
      "Dengage returned '400: BeginTime must be filled' during diagnostics - this form enforces both.",
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
