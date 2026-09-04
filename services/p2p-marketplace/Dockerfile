FROM node:18-alpine AS builder
WORKDIR /app

# Instalar OpenSSL requerido por Prisma
RUN apk add --no-cache openssl

# Copiar archivos de dependencias
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY prisma ./prisma/

# Instalar TODAS las dependencias (incluyendo devDependencies para compilar)
RUN npm install

# Generar cliente prisma
RUN npx prisma generate

# Copiar el resto del código y compilar
COPY . .
RUN npm run build

# === DIAGNÓSTICO: ver qué generó nest build ===
RUN echo "=== FIX TEST 9 - CONTENIDO DE /app/dist ===" && ls -laR /app/dist/ || echo "DIST NO EXISTE"

# --- Fase de Producción ---
FROM node:18-alpine
WORKDIR /app

RUN apk add --no-cache openssl

# Copiar prisma ANTES del install (el postinstall necesita el schema)
COPY package*.json ./
COPY --from=builder /app/prisma ./prisma
RUN npm install --omit=dev

# Copiar artefactos del builder
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma
COPY --from=builder /app/dist ./dist

# === DIAGNÓSTICO: ver qué llegó a producción ===
RUN echo "=== FIX TEST 9 - DIST EN PRODUCCION ===" && ls -laR /app/dist/ || echo "DIST NO EXISTE EN PROD"

EXPOSE 4000

CMD ["sh", "-c", "echo '=== FIX TEST 9 - ARRANCANDO ===' && ls -la /app/dist/ && npx prisma db push --accept-data-loss && node dist/main.js"]
