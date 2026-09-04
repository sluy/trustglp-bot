# 🤖 Telecambios VE — White-Label P2P Management Platform

> Sistema inteligente de gestión de equipos P2P con automatización algorítmica, market making y control de capital en tiempo real.

## ⚡ Inicio Rápido (Nuevo Cliente)

```bash
# 1. Clona el repositorio base
git clone https://github.com/tu-org/Telecambios VE.git mi-cliente
cd mi-cliente

# 2. Configura las variables de entorno
cp .env.example .env
# Edita .env con los datos del cliente

# 3. Levanta todo el stack
docker compose up -d

# 4. Accede al dashboard
open http://localhost:3001
```

## 🗂️ Estructura del Monorepo

```
Telecambios VE/
├── apps/
│   └── admin-dashboard/     # Next.js 14 — UI Principal
│       ├── app/
│       │   ├── page.tsx             → Home: Dual login (Operador/Admin)
│       │   ├── portal/login/        → Login administrador
│       │   ├── portal/operator/     → Login operador P2P
│       │   ├── admin/p2p/           → P2P Command Center
│       │   ├── admin/community/     → Comunidad ByBit
│       │   ├── admin/smart-index/   → Smart Index ETF
│       │   └── admin/config/        → Panel de Configuración
│       └── lib/theme.ts             → Sistema de temas white-label
│
└── services/
    ├── order-manager/         # NestJS — Backend principal
    │   └── src/config/        → Endpoints de configuración
    ├── bybit-grid-bot/        # Python — Grid + HMM
    ├── market-scanner/        # Python/FastAPI — Scanner P2P
    ├── p2p-marketplace/       # NestJS — Marketplace
    └── auto-pay-bot/          # Python — RPA bancario (OPCIONAL)
```

## 🎨 Personalización de Marca

Edita el `.env`:
```env
NEXT_PUBLIC_CLIENT_NAME="Tu Empresa Trading"
NEXT_PUBLIC_CLIENT_SLUG="tuempresa"
NEXT_PUBLIC_SUPPORT_EMAIL="soporte@tuempresa.com"
NEXT_PUBLIC_THEME=telecambios-ve
```

O desde el **Panel Admin** → `/admin/config`:
- Nombre y slug de la plataforma
- Colores primario y secundario (color picker)
- API Keys de Binance, Bybit y Telegram (cifradas)
- Modo de operación (full / p2p_only)

## 🎨 Temas Disponibles

| Tema | Colores | Uso |
|------|---------|-----|
| `telecambios-ve` | Violet + Gold (Default) | Marca genérica nueva |
| `frank` | Orange + Amber | Cliente "Frank" |
| `rafa` | Emerald + Teal | Cliente "Rafa" |

## 🔐 Rutas del Sistema

| Ruta | Acceso | Descripción |
|------|--------|-------------|
| `/` | Público | Home — Selección de portal |
| `/portal/operator` | Credenciales operador | Login operador P2P |
| `/portal/login` | Credenciales admin | Login administrador |
| `/admin/p2p` | Admin (Basic Auth) | P2P Command Center |
| `/admin/community` | Admin | Gestión comunidad |
| `/admin/smart-index` | Admin | Index ETF |
| `/admin/config` | Admin | Configuración plataforma |

## 🐳 Docker Compose

```bash
# Stack completo base
docker compose up -d

# Con módulo Auto-Pay Bot (opcional)
docker compose --profile optional up -d

# Solo desarrollo backend
docker compose up postgres redis -d
```

## 🔑 Variables de Entorno Clave

Ver `.env.example` para documentación completa.

| Variable | Descripción |
|----------|-------------|
| `ENCRYPTION_KEY` | Clave AES-256 para cifrar API keys (32 chars) |
| `JWT_SECRET` | Secret para tokens de auth |
| `ADMIN_PASSWORD` | Contraseña del área restringida /admin |
| `NEXT_PUBLIC_CLIENT_NAME` | Nombre visible de la plataforma |
| `NEXT_PUBLIC_CLIENT_SLUG` | ID único (usado en cookies) |

---
*Telecambios VE © 2025 — Base White-Label para Gestión P2P*