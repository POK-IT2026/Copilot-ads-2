/**
 * Seed de datos de demostración (30 días) para Meta Ads y Google Ads.
 * Uso: npm run seed
 *
 * El esquema está duplicado desde lib/db.ts (mantener en sync) para que el
 * script sea autónomo y se pueda ejecutar antes del primer arranque.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = fs
  .readFileSync(path.join(process.cwd(), "lib", "db.ts"), "utf8")
  .match(/const SCHEMA = `([\s\S]*?)`;/)?.[1];
if (!SCHEMA) {
  console.error("No se pudo extraer el esquema de lib/db.ts");
  process.exit(1);
}

const dbPath =
  process.env.DATABASE_PATH?.trim() || path.join(process.cwd(), "db", "campaign_copilot.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA);

const metaAccount =
  (process.env.META_AD_ACCOUNT_IDS ?? "").split(",")[0]?.trim().replace(/^(?!act_)/, "act_") ||
  "act_1234567890";
const googleAccount =
  (process.env.GOOGLE_ADS_CUSTOMER_IDS ?? "").split(",")[0]?.trim().replace(/-/g, "") ||
  "1234567890";

const DAYS = 30;
const dates = [];
for (let i = DAYS - 1; i >= 0; i--) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  dates.push(d.toISOString().slice(0, 10));
}

const rand = (min, max) => min + Math.random() * (max - min);
const jitter = (base) => base * rand(0.7, 1.3);

/* ── Meta Ads ──────────────────────────────────────────────────────────── */
// Perfiles por día y por anuncio, diseñados para disparar cada regla.
const META_CAMPAIGNS = [
  { id: "c1", name: "Prospecting Broad — Ventas MX", objective: "OUTCOME_SALES", status: "ACTIVE",
    ad: { spend: 22, impressions: 9000, ctrPct: 1.6, purchases: 1.1, aov: 78, freq: 2.1 } },
  { id: "c2", name: "Retargeting 30d — Compradoras", objective: "OUTCOME_SALES", status: "ACTIVE",
    ad: { spend: 9, impressions: 2600, ctrPct: 2.4, purchases: 0.9, aov: 92, freq: 3.2 } },
  { id: "c3", name: "Test Creativo UGC — Q3", objective: "OUTCOME_SALES", status: "ACTIVE",
    ad: { spend: 6, impressions: 5200, ctrPct: 1.1, purchases: 0, aov: 0, freq: 2.6 } },
  { id: "c4", name: "Lookalike 1% Compradoras", objective: "OUTCOME_SALES", status: "PAUSED",
    ad: { spend: 4, impressions: 3100, ctrPct: 1.3, purchases: 0.06, aov: 55, freq: 2.9 } },
  { id: "c5", name: "Awareness Video Views", objective: "OUTCOME_AWARENESS", status: "ACTIVE",
    ad: { spend: 3, impressions: 14000, ctrPct: 0.32, purchases: 0, aov: 0, freq: 5.1 } },
];

const insMetaAd = db.prepare(`INSERT INTO meta_ads_ad_daily
  (account_id, ad_id, ad_name, adset_id, adset_name, campaign_id, campaign_name, status,
   creative_id, thumbnail_url, date, spend, impressions, clicks, reach, frequency, ctr, cpc, cpm,
   purchases, purchase_value, roas, cpa)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT (account_id, ad_id, date) DO NOTHING`);
const insMetaAdset = db.prepare(`INSERT INTO meta_ads_adset_daily
  (account_id, adset_id, adset_name, campaign_id, campaign_name, status, date,
   spend, impressions, clicks, reach, frequency, ctr, cpc, cpm, purchases, purchase_value, roas, cpa)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT (account_id, adset_id, date) DO NOTHING`);
const insMetaCampaign = db.prepare(`INSERT INTO meta_ads_campaign_daily
  (account_id, campaign_id, campaign_name, objective, status, date,
   spend, impressions, clicks, reach, frequency, ctr, cpc, cpm, purchases, purchase_value, roas, cpa)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT (account_id, campaign_id, date) DO NOTHING`);

function metrics(spend, impressions, clicks, purchases, value, freq) {
  return {
    spend, impressions, clicks,
    reach: Math.round(impressions / Math.max(freq, 1)),
    frequency: freq,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    purchases,
    value,
    roas: spend > 0 ? value / spend : 0,
    cpa: purchases > 0 ? spend / purchases : 0,
  };
}

const seedMeta = db.transaction(() => {
  for (const c of META_CAMPAIGNS) {
    for (const date of dates) {
      let cSpend = 0, cImp = 0, cClicks = 0, cPur = 0, cVal = 0, cFreq = 0;
      for (let s = 1; s <= 2; s++) {
        const adsetId = `${c.id}-as${s}`;
        const adsetName = `${c.name} · Ad set ${s}`;
        let sSpend = 0, sImp = 0, sClicks = 0, sPur = 0, sVal = 0, sFreq = 0;
        for (let a = 1; a <= 2; a++) {
          const adId = `${adsetId}-ad${a}`;
          const spend = jitter(c.ad.spend);
          const impressions = Math.round(jitter(c.ad.impressions));
          const clicks = Math.round(impressions * (jitter(c.ad.ctrPct) / 100));
          const purchases = Math.random() < c.ad.purchases % 1 ? Math.ceil(c.ad.purchases) : Math.floor(c.ad.purchases);
          const value = purchases * jitter(c.ad.aov || 0);
          const freq = jitter(c.ad.freq);
          const m = metrics(spend, impressions, clicks, purchases, value, freq);
          insMetaAd.run(
            metaAccount, adId, `${c.name} · Anuncio ${s}.${a}`, adsetId, adsetName,
            c.id, c.name, c.status, `cr-${adId}`, null, date,
            m.spend, m.impressions, m.clicks, m.reach, m.frequency, m.ctr, m.cpc, m.cpm,
            m.purchases, m.value, m.roas, m.cpa
          );
          sSpend += m.spend; sImp += m.impressions; sClicks += m.clicks;
          sPur += m.purchases; sVal += m.value; sFreq += m.frequency;
        }
        const sm = metrics(sSpend, sImp, sClicks, sPur, sVal, sFreq / 2);
        insMetaAdset.run(
          metaAccount, adsetId, adsetName, c.id, c.name, c.status, date,
          sm.spend, sm.impressions, sm.clicks, sm.reach, sm.frequency, sm.ctr, sm.cpc, sm.cpm,
          sm.purchases, sm.value, sm.roas, sm.cpa
        );
        cSpend += sm.spend; cImp += sm.impressions; cClicks += sm.clicks;
        cPur += sm.purchases; cVal += sm.value; cFreq += sm.frequency;
      }
      const cm = metrics(cSpend, cImp, cClicks, cPur, cVal, cFreq / 2);
      insMetaCampaign.run(
        metaAccount, c.id, c.name, c.objective, c.status, date,
        cm.spend, cm.impressions, cm.clicks, cm.reach, cm.frequency, cm.ctr, cm.cpc, cm.cpm,
        cm.purchases, cm.value, cm.roas, cm.cpa
      );
    }
  }
});
seedMeta();

/* ── Google Ads ────────────────────────────────────────────────────────── */
const GOOGLE_CAMPAIGNS = [
  { id: "g1", name: "Search — Marca", channel: "SEARCH", status: "ENABLED",
    day: { cost: 45, impressions: 3200, ctrPct: 6.5, conv: 3.5, aov: 85 } },
  { id: "g2", name: "Performance Max — Catálogo", channel: "PERFORMANCE_MAX", status: "ENABLED",
    day: { cost: 70, impressions: 21000, ctrPct: 1.1, conv: 2.2, aov: 70 } },
  { id: "g3", name: "Search — Genéricas", channel: "SEARCH", status: "ENABLED",
    day: { cost: 25, impressions: 4100, ctrPct: 2.8, conv: 0.35, aov: 60 } },
];
const KEYWORDS = ["planchas de cabello", "secadora profesional", "rizadora ceramica"];

const insGCampaign = db.prepare(`INSERT INTO google_ads_campaign_daily
  (account_id, campaign_id, campaign_name, status, channel_type, date,
   cost, impressions, clicks, ctr, avg_cpc, conversions, conversions_value, roas, cpa)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT (account_id, campaign_id, date) DO NOTHING`);
const insGAdGroup = db.prepare(`INSERT INTO google_ads_adgroup_daily
  (account_id, ad_group_id, ad_group_name, campaign_id, campaign_name, status, date,
   cost, impressions, clicks, ctr, avg_cpc, conversions, conversions_value, roas, cpa)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT (account_id, ad_group_id, date) DO NOTHING`);
const insGAd = db.prepare(`INSERT INTO google_ads_ad_daily
  (account_id, ad_id, ad_name, ad_type, ad_group_id, ad_group_name, campaign_id, campaign_name, status, date,
   cost, impressions, clicks, ctr, avg_cpc, conversions, conversions_value, roas, cpa)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT (account_id, ad_id, date) DO NOTHING`);
const insGKeyword = db.prepare(`INSERT INTO google_ads_keyword_daily
  (account_id, criterion_id, keyword_text, match_type, ad_group_id, ad_group_name, campaign_id, campaign_name, date,
   cost, impressions, clicks, ctr, avg_cpc, conversions, conversions_value, roas, cpa)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT (account_id, ad_group_id, criterion_id, date) DO NOTHING`);

function gMetrics(cost, impressions, clicks, conv, value) {
  return {
    cost, impressions, clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    avgCpc: clicks > 0 ? cost / clicks : 0,
    conv,
    value,
    roas: cost > 0 ? value / cost : 0,
    cpa: conv > 0 ? cost / conv : 0,
  };
}

const seedGoogle = db.transaction(() => {
  for (const c of GOOGLE_CAMPAIGNS) {
    for (const date of dates) {
      let tCost = 0, tImp = 0, tClicks = 0, tConv = 0, tVal = 0;
      for (let g = 1; g <= 2; g++) {
        const agId = `${c.id}-ag${g}`;
        const agName = `${c.name} · Grupo ${g}`;
        const cost = jitter(c.day.cost / 2);
        const impressions = Math.round(jitter(c.day.impressions / 2));
        const clicks = Math.round(impressions * (jitter(c.day.ctrPct) / 100));
        const conv = Number(jitter(c.day.conv / 2).toFixed(2));
        const value = conv * jitter(c.day.aov);
        const m = gMetrics(cost, impressions, clicks, conv, value);
        insGAdGroup.run(
          googleAccount, agId, agName, c.id, c.name, "ENABLED", date,
          m.cost, m.impressions, m.clicks, m.ctr, m.avgCpc, m.conv, m.value, m.roas, m.cpa
        );
        insGAd.run(
          googleAccount, `${agId}-ad1`, `${agName} · RSA`, "RESPONSIVE_SEARCH_AD",
          agId, agName, c.id, c.name, "ENABLED", date,
          m.cost, m.impressions, m.clicks, m.ctr, m.avgCpc, m.conv, m.value, m.roas, m.cpa
        );
        if (c.channel === "SEARCH") {
          KEYWORDS.forEach((kw, k) => {
            const share = 1 / KEYWORDS.length;
            const km = gMetrics(
              m.cost * share, Math.round(m.impressions * share),
              Math.round(m.clicks * share), Number((m.conv * share).toFixed(2)),
              m.value * share
            );
            insGKeyword.run(
              googleAccount, `${agId}-kw${k + 1}`, kw, k === 0 ? "EXACT" : "PHRASE",
              agId, agName, c.id, c.name, date,
              km.cost, km.impressions, km.clicks, km.ctr, km.avgCpc, km.conv, km.value, km.roas, km.cpa
            );
          });
        }
        tCost += m.cost; tImp += m.impressions; tClicks += m.clicks; tConv += m.conv; tVal += m.value;
      }
      const cm = gMetrics(tCost, tImp, tClicks, Number(tConv.toFixed(2)), tVal);
      insGCampaign.run(
        googleAccount, c.id, c.name, c.status, c.channel, date,
        cm.cost, cm.impressions, cm.clicks, cm.ctr, cm.avgCpc, cm.conv, cm.value, cm.roas, cm.cpa
      );
    }
  }
});
seedGoogle();

/* ── Recomendaciones (mismas reglas que lib/rules.ts, versión compacta) ── */
function evaluate(e, avg, noun) {
  const out = [];
  const noConv = e.spend > 500 && e.conversions === 0;
  if (noConv)
    out.push(["high_spend_no_purchases", "high", `Gasto alto sin ${noun}`,
      `"${e.name}" gastó $${e.spend.toFixed(0)} en el periodo sin registrar ${noun}.`]);
  if (!noConv && e.spend > 100 && e.roas < 1.5)
    out.push(["low_roas", "high", "ROAS bajo",
      `"${e.name}" tiene un ROAS de ${e.roas.toFixed(2)} con $${e.spend.toFixed(0)} de gasto.`]);
  if (e.conversions > 0 && avg.cpa > 0 && e.cpa > 1.5 * avg.cpa)
    out.push(["high_cpa", "medium", "CPA elevado",
      `"${e.name}" tiene un CPA de $${e.cpa.toFixed(2)} vs. promedio $${avg.cpa.toFixed(2)}.`]);
  if (e.impressions > 5000 && e.ctr < 0.5)
    out.push(["low_ctr", "medium", "CTR bajo",
      `"${e.name}" tiene un CTR de ${e.ctr.toFixed(2)}% con ${e.impressions} impresiones.`]);
  if (e.frequency > 4 && avg.ctr > 0 && e.ctr < avg.ctr)
    out.push(["high_frequency", "medium", "Frecuencia alta",
      `"${e.name}" tiene frecuencia ${e.frequency.toFixed(1)} y CTR por debajo del promedio.`]);
  if (avg.roas > 0 && e.roas > 1.5 * avg.roas && e.spend > 100)
    out.push(["top_performer", "low", "Top performer",
      `"${e.name}" tiene un ROAS de ${e.roas.toFixed(2)} (${(e.roas / avg.roas).toFixed(1)}x el promedio).`]);
  return out;
}

function aggregate(table, idCol, nameCol, account, spendCol, convCol, valCol, freqExpr) {
  return db.prepare(`
    SELECT ${idCol} id, MAX(${nameCol}) name, SUM(${spendCol}) spend,
           SUM(impressions) impressions, SUM(clicks) clicks,
           SUM(${convCol}) conversions, SUM(${valCol}) value, ${freqExpr} frequency
    FROM ${table} WHERE account_id = ? GROUP BY ${idCol}`).all(account)
    .map((r) => ({
      ...r,
      ctr: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0,
      roas: r.spend > 0 ? r.value / r.spend : 0,
      cpa: r.conversions > 0 ? r.spend / r.conversions : 0,
    }));
}

function averages(rows) {
  const spend = rows.reduce((a, r) => a + r.spend, 0);
  const imp = rows.reduce((a, r) => a + r.impressions, 0);
  const clicks = rows.reduce((a, r) => a + r.clicks, 0);
  const conv = rows.reduce((a, r) => a + r.conversions, 0);
  const val = rows.reduce((a, r) => a + r.value, 0);
  return {
    ctr: imp > 0 ? (clicks / imp) * 100 : 0,
    cpa: conv > 0 ? spend / conv : 0,
    roas: spend > 0 ? val / spend : 0,
  };
}

const dateFrom = dates[0];
const dateTo = dates[dates.length - 1];

const metaCampAgg = aggregate("meta_ads_campaign_daily", "campaign_id", "campaign_name",
  metaAccount, "spend", "purchases", "purchase_value", "AVG(frequency)");
const metaAvg = averages(metaCampAgg);
const insMetaRec = db.prepare(`INSERT INTO meta_ads_recommendations
  (account_id, level, entity_id, entity_name, rule, priority, title, detail, kpi_snapshot)
  VALUES (?,?,?,?,?,?,?,?,?)`);
db.prepare(`DELETE FROM meta_ads_recommendations WHERE account_id=? AND status='pending'`).run(metaAccount);
let metaRecs = 0;
for (const e of metaCampAgg) {
  for (const [rule, priority, title, detail] of evaluate(e, metaAvg, "compras")) {
    insMetaRec.run(metaAccount, "campaign", e.id, e.name, rule, priority, title, detail,
      JSON.stringify({ dateFrom, dateTo, ...e, account_avg: metaAvg }));
    metaRecs++;
  }
}

const gCampAgg = aggregate("google_ads_campaign_daily", "campaign_id", "campaign_name",
  googleAccount, "cost", "conversions", "conversions_value", "0");
const gAvg = averages(gCampAgg);
const insGRec = db.prepare(`INSERT INTO google_ads_recommendations
  (account_id, level, entity_id, entity_name, rule, priority, title, detail, kpi_snapshot)
  VALUES (?,?,?,?,?,?,?,?,?)`);
db.prepare(`DELETE FROM google_ads_recommendations WHERE account_id=? AND status='pending'`).run(googleAccount);
let gRecs = 0;
for (const e of gCampAgg) {
  for (const [rule, priority, title, detail] of evaluate(e, gAvg, "conversiones")) {
    insGRec.run(googleAccount, "campaign", e.id, e.name, rule, priority, title, detail,
      JSON.stringify({ dateFrom, dateTo, ...e, account_avg: gAvg }));
    gRecs++;
  }
}

// Registrar un sync run de demostración
db.prepare(`INSERT INTO meta_ads_sync_runs
  (account_id, date_from, date_to, status, campaigns_rows, adsets_rows, ads_rows, recommendations_count, finished_at)
  VALUES (?,?,?,?,?,?,?,?,datetime('now'))`)
  .run(metaAccount, dateFrom, dateTo, "success",
    META_CAMPAIGNS.length * DAYS, META_CAMPAIGNS.length * 2 * DAYS,
    META_CAMPAIGNS.length * 4 * DAYS, metaRecs);

console.log(`Seed completado en ${dbPath}`);
console.log(`  Meta   → cuenta ${metaAccount}: ${META_CAMPAIGNS.length} campañas x ${DAYS} días, ${metaRecs} recomendaciones`);
console.log(`  Google → cliente ${googleAccount}: ${GOOGLE_CAMPAIGNS.length} campañas x ${DAYS} días, ${gRecs} recomendaciones`);
console.log(`\nConfigura META_AD_ACCOUNT_IDS=${metaAccount} y GOOGLE_ADS_CUSTOMER_IDS=${googleAccount} en .env.local para ver los datos en el dashboard.`);
