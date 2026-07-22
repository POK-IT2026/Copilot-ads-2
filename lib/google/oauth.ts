import fs from "node:fs";
import path from "node:path";

export const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";

export function googleOAuthReady() {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() &&
      process.env.GOOGLE_ADS_CLIENT_ID?.trim() &&
      process.env.GOOGLE_ADS_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_ADS_CUSTOMER_IDS?.trim()
  );
}

export function googleAdsConnected() {
  return googleOAuthReady() && Boolean(process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim());
}

function envPath() {
  return path.join(process.cwd(), ".env.local");
}

export function upsertLocalEnv(key: string, value: string) {
  const file = envPath();
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/) : [];
  let found = false;
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) next.push(`${key}=${value}`);
  fs.writeFileSync(file, next.join("\n").replace(/\n*$/, "\n"));
  process.env[key] = value;
}
