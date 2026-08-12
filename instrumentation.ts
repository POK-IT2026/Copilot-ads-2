/**
 * Se ejecuta una sola vez cuando arranca el server de Next.js (dev y
 * producción). Aquí prendemos el sync automático de Meta + Google Ads para
 * no depender del botón "Actualizar". Ver lib/autoSync.ts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startAutoSync } = await import("./lib/autoSync");
  startAutoSync();
}
