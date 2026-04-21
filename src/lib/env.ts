function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  dengageBaseUrl: () => (process.env.DENGAGE_BASE_URL || "https://api.dengage.com/rest").replace(/\/$/, ""),
  dengageUserkey: () => required("DENGAGE_USERKEY"),
  dengagePassword: () => required("DENGAGE_PASSWORD"),
  /** UUID of the Dengage account - required by the anonymous Event API
   *  (https://event.dengage.com/api/web/event). Ask your account manager. */
  dengageAccountId: () => required("DENGAGE_ACCOUNT_ID"),
  portalPassword: () => required("PORTAL_PASSWORD"),
  sessionSecret: () => required("SESSION_SECRET"),
  defaultDemoRecipient: () => process.env.DEFAULT_DEMO_RECIPIENT || "",
};
