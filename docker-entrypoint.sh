#!/bin/sh
set -e

echo "→ Esperando a que la base de datos esté lista..."
# Aunque docker-compose ya espera el healthcheck, este script puede
# correr también fuera de compose (ej. en un entorno de CI), así que
# reforzamos con un pequeño retry manual usando netcat-alpine-friendly approach
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

# Ejecuta las migraciones usando el mismo binario que ya tienes
# configurado en package.json ("typeorm": "typeorm-ts-node-commonjs")
npm run typeorm -- migration:run -d dist/database/data-source.js

echo "→ Migraciones aplicadas."
echo "→ Iniciando aplicación..."

# "exec" reemplaza el proceso del shell por el de Node, en vez de
# crear un proceso hijo. Esto es importante para que las señales
# de Docker (SIGTERM al hacer `docker stop`) lleguen directamente
# al proceso de Node y la app pueda apagarse de forma ordenada
exec "$@"