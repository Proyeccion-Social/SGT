#!/bin/sh
set -e

echo "→ Esperando a que la base de datos esté lista..."
until node -e "
  const net = require('net');
  const socket = net.createConnection(${LOCAL_DB_PORT:-5432}, '${LOCAL_DB_HOST}');
  socket.on('connect', () => { socket.end(); process.exit(0); });
  socket.on('error', () => process.exit(1));
"; do
  echo "  Postgres aún no responde, reintentando en 2s..."
  sleep 2
done

echo "→ Base de datos disponible."
echo "→ Ejecutando migraciones pendientes..."

# npx typeorm (NO npm run typeorm): el script de package.json usa
# typeorm-ts-node-commonjs, que requiere ts-node — una devDependency
# ausente en esta imagen. `typeorm` en sí SÍ es dependencia de producción,
# así que su CLI está disponible vía npx sin necesitar ts-node,
# apuntando directo al data-source YA COMPILADO.
npx typeorm migration:run -d dist/db/data-source.js

echo "→ Migraciones aplicadas."
echo "→ Iniciando aplicación..."

exec "$@"