export function getMetaAccounts(): string[] {
  return (process.env.META_AD_ACCOUNT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => (id.startsWith("act_") ? id : `act_${id}`));
}

export function getGoogleAccounts(): string[] {
  return (process.env.GOOGLE_ADS_CUSTOMER_IDS ?? "")
    .split(",")
    .map((s) => s.replace(/-/g, "").trim())
    .filter(Boolean);
}
