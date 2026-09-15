# Despliegue · PlayOut Kids

Notas de operación del fork de PlayOut Kids. El resto del repo es upstream de Raúl.

## Dónde vive

| Ambiente | Path en el VPS | Contenedor | Puerto |
|---|---|---|---|
| Sandbox | `/var/www/media-sandbox.playoutkids.com` | `campaign-copilot-sandbox` | `127.0.0.1:3005` |
| Producción | `/var/www/media.playoutkids.com` | `campaign-copilot-prod` | `127.0.0.1:3006` |

**No hay sitio propio en nginx.** La Media Suite se sirve como `/media` dentro de
la configuración del ERP (`/etc/nginx/sites-available/erp.playoutkids.com`), con
tres bloques `location` que hacen proxy al puerto de arriba, detrás de Basic Auth.

Consecuencia práctica: **actualizar la Media Suite no requiere tocar nginx.** Es
cambiar el contenedor que escucha en ese puerto.

## Los overrides de compose no son opcionales

El `docker-compose.yml` base es upstream y publica en `3000:3000`. Si levantas sin
override, el contenedor queda en `0.0.0.0:3000` y nginx **no lo alcanza**, porque
apunta a `127.0.0.1:3005` o `:3006`.

```
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

`ports: !override` reemplaza el array del base. Con `!reset` se borraría la key sin
definir la nueva, que no es lo que queremos. Requiere Compose 2.24 o superior.

## La base de datos

SQLite en `./db`, montada como volumen. **Es el dato real**: ahí está el histórico
de sincronizaciones de campañas. No vive en la imagen.

Dos cosas que ya costaron un incidente:

1. **El dueño tiene que ser `1001:1001`.** El contenedor corre como `nextjs` uid
   1001. Si el directorio queda como `deploy`, la app arranca pero falla al
   escribir con *"attempt to write a readonly database"* — y solo se nota al
   guardar un filtro o actualizar fuentes, no al cargar la página.
2. **Está en modo WAL.** Al copiarla hay que llevar los tres archivos: `.db`,
   `-shm` y `-wal`. Copiar solo el `.db` pierde las escrituras que estén en el WAL.
   Mejor aún: detener el contenedor antes de copiar.

## Migración V0 → V1 · producción, 15-sep-2026

Producción corría el repo viejo `POK-IT2026/CopilotADS`. Ahora corre
`POK-IT2026/Copilot-ads-2`, rama `playoutkids-integration`, commit `f091181` — el
mismo que el sandbox llevaba tres días ejecutando y que ya estaba validado.

El método, por si hay que repetirlo: clonar el V1 **en paralelo**, probarlo en un
puerto temporal con una copia de la base de producción mientras el V0 sigue
sirviendo, y solo entonces hacer el cambio. La ventana de indisponibilidad fue de
un par de minutos, la que tarda el build.

Verificar el contenedor **directo**, no a través de nginx: el Basic Auth se evalúa
antes del `proxy_pass`, así que un `401` desde afuera no prueba que el contenedor
esté vivo.

```
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3006/media
```

Next tarda unos segundos en escuchar. Un `000` recién levantado es normal;
repetir a los diez segundos.

### Vuelta atrás

El V0 sigue en disco mientras nadie lo borre:

- `/var/www/media.playoutkids.com.v0-retirado` — el que estaba sirviendo
- `/var/www/media.playoutkids.com.v0-backup-20260915` — copia previa al cambio

```
cd /var/www/media.playoutkids.com
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml down
cd /var/www
sudo mv media.playoutkids.com media-v1
sudo mv media.playoutkids.com.v0-retirado media.playoutkids.com
cd /var/www/media.playoutkids.com
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Borrar esos dos directorios cuando haya pasado tiempo suficiente sin incidentes.
Ocupan poco, así que no urge.

## Remotes

El naming difiere entre máquinas y confundirlo hace perder tiempo:

- **Mac** `~/Herd/media-suite/CopilotADS`: `fork` es el nuestro, `upstream` es el de
  Raúl, `v0` es el repo viejo.
- **VPS**: `origin` es el nuestro.
