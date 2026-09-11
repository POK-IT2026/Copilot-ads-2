import type { NextConfig } from "next";

/**
 * PlayOut Kids · Media Suite integration
 * Media Suite vive como path /media dentro del ERP (erp.playoutkids.com/media).
 * Nginx del ERP hace reverse proxy a este Node app corriendo en Docker.
 * basePath + assetPrefix aseguran que assets, routes y links internos respeten el prefix.
 * 2026-07-27 · assetPrefix activado tras verificar que sin él los /_next/static/*
 * no cargaban correctamente detrás del reverse proxy + Basic Auth.
 */
const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/media",
  assetPrefix: "/media",
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
