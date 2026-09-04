FROM node:18-alpine AS builder
WORKDIR /app

# Instalar OpenSSL requerido por Prisma
RUN apk add --no-cache openssl

# Copiar archivos de dependencias
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY prisma ./prisma/

# Instalar dependencias
RUN npm install

# Generar cliente prisma
RUN npx prisma generate

# Copiar el resto del código y compilar Nest
COPY . .
RUN npm run build

# --- Fase de Producción ---
FROM node:18-alpine
WORKDIR /app

RUN apk add --no-cache openssl

# Copiar dependencias de producción y build
COPY package*.json ./
RUN npm install --only=production
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# Lanzar migracion y servidor
CMD npx prisma db push --accept-data-loss && node dist/main.js
