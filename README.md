# Campaign Copilot v2

Dashboard web para monitorear **Meta Ads** y **Google Ads** con base de datos
SQLite local. Sin sistema de marcas, sin autenticación y sin ORM: las
credenciales viven únicamente en variables de entorno.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript 5
- Tailwind CSS 4
- better-sqlite3 (SQLite en `db/campaign_copilot.db`, modo WAL, foreign keys ON)
- @anthropic-ai/sdk (opcional, para análisis con IA)
- Docker + docker-compose para producción

## Puesta en marcha

```bash
npm install
cp .env.local.example .env.local   # completa tus tokens
npm run dev                        # http://localhost:3000
```

¿Sin credenciales todavía? Carga datos de demostración:

```bash
npm run seed
```

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `META_ACCESS_TOKEN` | Token de la Graph API con `ads_read` |
| `META_AD_ACCOUNT_IDS` | Cuentas separadas por coma (`act_...`) |
| `META_API_VERSION` | Versión de la Graph API (default `v23.0`) |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Developer token de Google Ads |
| `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` | Credenciales OAuth2 |
| `GOOGLE_ADS_REFRESH_TOKEN` | Refresh token OAuth2 |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | MCC (opcional, sin guiones) |
| `GOOGLE_ADS_CUSTOMER_IDS` | Clientes separados por coma (sin guiones) |
| `GOOGLE_ADS_API_VERSION` | Versión de la API (default `v20`) |
| `ANTHROPIC_API_KEY` | Opcional — habilita el análisis con IA |
| `ANTHROPIC_MODEL` | Opcional (default `claude-opus-4-8`) |
| `DATABASE_PATH` | Opcional — ruta del archivo SQLite |
| `AUTO_SYNC_INTERVAL_MINUTES` | Opcional — cada cuánto sincroniza en segundo plano (default `60`) |
| `AUTO_SYNC_WINDOW_DAYS` | Opcional — ventana de días hacia atrás por corrida (default `30`) |
| `AUTO_SYNC_DISABLED` | Opcional — pon `1` para apagar el sync automático |

## Sync automático

Al arrancar el server (`npm run dev` o `npm start`/Docker), [instrumentation.ts](instrumentation.ts)
prende un timer en segundo plano ([lib/autoSync.ts](lib/autoSync.ts)) que sincroniza Meta Ads y
Google Ads (si está conectado) cada hora, sin necesidad de darle a "Actualizar". Cada corrida
trae los últimos `AUTO_SYNC_WINDOW_DAYS` días (default 30) para todas las cuentas configuradas en
`META_AD_ACCOUNT_IDS` / `GOOGLE_ADS_CUSTOMER_IDS`. Los syncs de Meta quedan registrados en la misma
tabla que usa el botón manual, así que "Último sync" en `/meta-ads` también refleja las corridas
automáticas. El botón "Actualizar" sigue funcionando igual para forzar un refresh inmediato.

## Páginas

| Ruta | Descripción |
| --- | --- |
| `/` | Redirect a `/meta-ads` |
| `/meta-ads` | Dashboard principal — KPIs, gasto diario, alertas |
| `/meta-ads/campaigns` | Tabla de campañas ordenable |
| `/meta-ads/adsets` | Tabla de ad sets |
| `/meta-ads/ads` | Tabla de anuncios con vista previa (iframe de Meta) |
| `/meta-ads/creatives` | Tarjetas: Ganador / Neutral / Perdedor / Sin datos |
| `/meta-ads/top-performers` | Ranking por ROAS, compras y CTR |
| `/meta-ads/alerts` | Alertas automáticas por reglas (en vivo) |
| `/meta-ads/recommendations` | Recomendaciones pendientes / hechas / descartadas |
| `/google-ads` | Dashboard Google Ads (campañas, ad groups, keywords, anuncios) |

Los filtros globales viven en la URL (`?accountId=&dateFrom=&dateTo=`), son
compartibles y se conservan al navegar. Presets de 7d / 30d / 90d en el header.

## API Routes

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/meta-ads/sync` | Sincroniza insights de Meta (campaña/ad set/anuncio, diario) y genera recomendaciones |
| `POST` | `/api/google-ads/sync` | Sincroniza Google Ads vía GAQL (campañas, ad groups, anuncios, keywords) |
| `GET` | `/api/ad-preview?adId=` | HTML del iframe de vista previa de Meta (`DESKTOP_FEED_STANDARD`) |
| `PATCH` | `/api/recommendations/{id}` | Cambia estado (`done` requiere nota, `discarded`) |
| `POST` | `/api/ai-analysis` | Análisis con Claude (requiere `ANTHROPIC_API_KEY`) |

## Motor de recomendaciones

Se generan al sincronizar (las pendientes anteriores se reemplazan; el
historial de hechas/descartadas se conserva). Cada una guarda un snapshot JSON
de KPIs al momento de generarse.

| Regla | Condición | Prioridad |
| --- | --- | --- |
| `high_spend_no_purchases` | gasto > $500 sin compras | alta |
| `low_roas` | gasto > $100 y ROAS < 1.5 | alta |
| `high_cpa` | CPA > 1.5x el promedio de la cuenta | media |
| `low_ctr` | impresiones > 5,000 y CTR < 0.5% | media |
| `high_frequency` | frecuencia > 4 y CTR < promedio | media |
| `top_performer` | ROAS > 1.5x promedio y gasto > $100 | baja |

## Rate limiting (Meta)

El cliente Graph API lee el header `X-Business-Use-Case-Usage` (pausa si el
uso supera el 90%) y reintenta con backoff exponencial los errores de
throttling (códigos 17, 32 y 80000–80004).

## Producción con Docker

```bash
cp .env.production.example .env.production   # completa tus tokens
docker compose up --build -d
```

- Dockerfile multi-stage (`node:20-alpine`): deps → builder → runner, con
  `python3 make g++` para compilar better-sqlite3.
- `output: 'standalone'` en `next.config.ts`.
- El volumen `./db:/app/db` persiste SQLite fuera del contenedor.
