import { env } from "./env";

export type DengageEndpoint = {
  id: string;
  name: string;
  description: string;
  docsUrl?: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  /** Path relative to DENGAGE_BASE_URL, must start with "/". */
  path: string;
  /** Starter JSON body shown in the editor. A function so we can inject env defaults. */
  defaultPayload: () => unknown;
  /** Short notes rendered on the demo page (markdown-ish, rendered as plain text). */
  notes?: string[];
};

export const endpoints: DengageEndpoint[] = [
  {
    id: "send-transactional-email",
    name: "Send Transactional Email",
    description:
      "Sends a single transactional email via a pre-configured Dengage template. Great for order confirmations, password resets, receipts, etc.",
    docsUrl: "https://dev.dengage.com/reference/sendtransactionalemail",
    method: "POST",
    path: "/sendtransactionalemail",
    defaultPayload: () => ({
      to: env.defaultDemoRecipient() || "recipient@example.com",
      templateId: "REPLACE_WITH_TEMPLATE_ID",
      subject: "Hello from the Dengage showcase portal",
      from: "no-reply@yourdomain.com",
      fromName: "Dengage Demo",
      params: {
        firstName: "Prospect",
        product: "Dengage Transactional",
      },
    }),
    notes: [
      "Replace templateId with a real template from your Dengage panel.",
      "The default recipient is taken from DEFAULT_DEMO_RECIPIENT env var.",
      "If Dengage's actual field names differ (case, nesting), edit the JSON below before sending - the portal sends exactly what you see.",
    ],
  },

  // ---- Add more APIs by appending entries here. Example: ----
  // {
  //   id: "create-contact",
  //   name: "Create Contact",
  //   description: "Create or update a Dengage contact.",
  //   method: "POST",
  //   path: "/contact",
  //   defaultPayload: () => ({ contactKey: "demo@example.com", firstName: "Demo" }),
  // },
];

export function getEndpoint(id: string): DengageEndpoint | undefined {
  return endpoints.find((e) => e.id === id);
}
