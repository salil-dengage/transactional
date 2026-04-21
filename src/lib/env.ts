function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  dengageBaseUrl: () => (process.env.DENGAGE_BASE_URL || "https://api.dengage.com/rest").replace(/\/$/, ""),
  dengageUserkey: () => required("DENGAGE_USERKEY"),
  dengagePassword: () => required("DENGAGE_PASSWORD"),
  portalPassword: () => required("PORTAL_PASSWORD"),
  sessionSecret: () => required("SESSION_SECRET"),
  defaultDemoRecipient: () => process.env.DEFAULT_DEMO_RECIPIENT || "",
};
