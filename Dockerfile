# ============================================================
# STAGE 1: Dependencias + build
# ============================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copiamos solo los manifiestos primero — esto es clave para el cache de Docker:
# si package.json no cambia, Docker reutiliza esta capa en builds futuros
# y no reinstala node_modules cada vez que cambias un .ts
COPY package.json package-lock.json ./

# Instalamos TODAS las dependencias (incluye devDependencies, necesarias
# para compilar con `nest build`, que usa @nestjs/cli y typescript)
RUN npm ci

# Ahora sí copiamos el resto del código fuente
COPY . .

# Compila TypeScript → JavaScript en /app/dist (según tu script "build": "nest build")
RUN npm run build

# ============================================================
# STAGE 2: Imagen final de producción — mucho más liviana
# ============================================================
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copiamos solo los manifiestos para instalar dependencias de producción
COPY package.json package-lock.json ./

# --omit=dev: NO instala devDependencies (typescript, jest, eslint, etc.)
# Esto hace que la imagen final sea mucho más pequeña
RUN npm ci --omit=dev

# Copiamos SOLO el resultado compilado desde el stage anterior,
# no el código fuente .ts ni node_modules del builder
COPY --from=builder /app/dist ./dist

# Script de entrada: corre migraciones y luego arranca la app (ver sección 4)
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]