import { NextResponse } from "next/server";
import { getGoogleAccounts } from "@/lib/env";
import {
  gaqlSearch,
  getGoogleAccessToken,
  googleAdsApiVersion,
  listAccessibleGoogleCustomers,
} from "@/lib/google/api";

export const dynamic = "force-dynamic";

type StepStatus = "ok" | "error" | "pending";

interface DiagnosticStep {
  key: string;
  label: string;
  status: StepStatus;
  detail: string;
}

function cleanCustomerId(value: string) {
  return value.replace(/-/g, "").trim();
}

function step(key: string, label: string, status: StepStatus, detail: string): DiagnosticStep {
  return { key, label, status, detail };
}

function envStatus() {
  return {
    apiVersion: googleAdsApiVersion(),
    developerToken: Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()),
    clientId: Boolean(process.env.GOOGLE_ADS_CLIENT_ID?.trim()),
    clientSecret: Boolean(process.env.GOOGLE_ADS_CLIENT_SECRET?.trim()),
    refreshToken: Boolean(process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim()),
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, "").trim() ?? "",
    customerIds: getGoogleAccounts().map(cleanCustomerId),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const configuredAccounts = getGoogleAccounts().map(cleanCustomerId);
  const accountId = cleanCustomerId(url.searchParams.get("accountId") ?? configuredAccounts[0] ?? "");
  const status = envStatus();
  const steps: DiagnosticStep[] = [];

  const missing = [
    ["developer token", status.developerToken],
    ["OAuth client id", status.clientId],
    ["OAuth client secret", status.clientSecret],
    ["refresh token", status.refreshToken],
    ["customer id", Boolean(accountId)],
  ]
    .filter(([, ok]) => !ok)
    .map(([label]) => label);

  steps.push(
    step(
      "config",
      "Variables locales",
      missing.length === 0 ? "ok" : "pending",
      missing.length === 0
        ? "Credenciales base presentes en .env.local."
        : `Falta configurar: ${missing.join(", ")}.`
    )
  );

  if (missing.length > 0) {
    return NextResponse.json({ ok: false, accountId, status, accessibleCustomers: [], steps });
  }

  try {
    await getGoogleAccessToken();
    steps.push(step("oauth", "OAuth refresh token", "ok", "Google entrego un access token valido."));
  } catch (err) {
    steps.push(
      step(
        "oauth",
        "OAuth refresh token",
        "error",
        err instanceof Error ? err.message : String(err)
      )
    );
    return NextResponse.json({ ok: false, accountId, status, accessibleCustomers: [], steps });
  }

  let accessibleCustomers: string[] = [];
  try {
    accessibleCustomers = (await listAccessibleGoogleCustomers()).map((resource) =>
      resource.replace("customers/", "")
    );
    steps.push(
      step(
        "accessible",
        "Cuentas accesibles",
        "ok",
        accessibleCustomers.length > 0
          ? `OAuth ve ${accessibleCustomers.length} cuenta(s): ${accessibleCustomers.join(", ")}.`
          : "OAuth es valido, pero no aparecen cuentas accesibles directas."
      )
    );
  } catch (err) {
    steps.push(
      step(
        "accessible",
        "Cuentas accesibles",
        "error",
        err instanceof Error ? err.message : String(err)
      )
    );
    return NextResponse.json({ ok: false, accountId, status, accessibleCustomers, steps });
  }

  try {
    const rows = await gaqlSearch(
      accountId,
      `SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone
       FROM customer LIMIT 1`
    );
    const customer = (rows[0]?.customer ?? {}) as Record<string, unknown>;
    const name = String(customer.descriptiveName ?? "sin nombre");
    steps.push(
      step(
        "customer",
        "Customer configurado",
        "ok",
        `Consulta GAQL correcta para ${accountId}: ${name}.`
      )
    );
  } catch (err) {
    steps.push(
      step(
        "customer",
        "Customer configurado",
        "error",
        err instanceof Error ? err.message : String(err)
      )
    );
    return NextResponse.json({ ok: false, accountId, status, accessibleCustomers, steps });
  }

  return NextResponse.json({ ok: true, accountId, status, accessibleCustomers, steps });
}
