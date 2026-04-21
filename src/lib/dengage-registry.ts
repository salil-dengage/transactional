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

export const endpoints: DengageEndpoint[] = [
  // 1) LIST TRANSACTIONAL TEMPLATES
  {
    id: "list-transactional-templates",
    name: "List Transactional Email Templates",
    description:
      "Fetch all transactional email templates configured in your Dengage workspace. Use this to discover template IDs before sending.",
    category: "messaging",
    tags: ["email", "templates"],
    docsUrl: "https://dev.dengage.com/reference/",
    method: "GET",
    path: "/transactional/email",
    previewKind: "template-list",
    defaultPayload: () => ({}),
    notes: [
      "This endpoint powers the template picker in the Send Transactional Email demo.",
      "No body required - it's a GET.",
    ],
  },

  // 2) SEND TRANSACTIONAL EMAIL
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
          label: "Template",
          type: "async-select",
          required: true,
          sourceEndpointId: "list-transactional-templates",
          itemsPath: "data",
          valueKey: "id",
          labelKey: "name",
          help: "Pulled live from your Dengage workspace.",
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
      "Pick a templateId from your Dengage workspace - the dropdown fetches them live.",
      "Keys under 'Personalization variables' are passed into your template's merge tags.",
      "If Dengage rejects a field name, open Developer view and adjust the JSON directly - the portal sends exactly what you see.",
    ],
  },

  // 3) TRANSACTIONAL EMAIL REPORT
  {
    id: "transactional-email-report",
    name: "Transactional Email Report",
    description:
      "Pull delivery, open, click, and bounce statistics for transactional emails sent in a time window.",
    category: "reports",
    tags: ["email", "transactional", "analytics"],
    docsUrl: "https://dev.dengage.com/reference/gettransactionalemailreport",
    method: "GET",
    path: "/transactional/email/report",
    previewKind: "delivery-report",
    form: {
      fields: [
        {
          name: "startDate",
          label: "Start date",
          type: "text",
          placeholder: "YYYY-MM-DD",
          help: "Start of the reporting window.",
          payloadPath: "startDate",
        },
        {
          name: "endDate",
          label: "End date",
          type: "text",
          placeholder: "YYYY-MM-DD",
          help: "End of the reporting window.",
          payloadPath: "endDate",
        },
        {
          name: "templateId",
          label: "Template filter (optional)",
          type: "async-select",
          sourceEndpointId: "list-transactional-templates",
          itemsPath: "data",
          valueKey: "id",
          labelKey: "name",
          help: "Restrict the report to a single template.",
        },
      ],
    },
    scenarios: [
      {
        id: "last-24h",
        name: "Last 24 hours",
        values: (() => {
          const now = new Date();
          const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          return {
            startDate: yesterday.toISOString().slice(0, 10),
            endDate: now.toISOString().slice(0, 10),
          };
        })(),
      },
      {
        id: "last-7d",
        name: "Last 7 days",
        values: (() => {
          const now = new Date();
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return {
            startDate: weekAgo.toISOString().slice(0, 10),
            endDate: now.toISOString().slice(0, 10),
          };
        })(),
      },
    ],
    defaultPayload: () => ({}),
    notes: [
      "The portal sends the date fields as query-string parameters on this GET request.",
      "Exact field names may differ by workspace - check your Dengage docs if the server returns 400.",
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
