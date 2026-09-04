# Guía para Añadir Nuevos Temas

Esta guía explica paso a paso cómo agregar un nuevo tema (ej. `rafa`, `frank`) al proyecto `admin-dashboard`, manteniendo la arquitectura multi-cliente y evitando ensuciar el código con colores fijos.

## 1. Declarar el Tema en `lib/theme.ts`

El primer paso es registrar el tema para que esté disponible globalmente:

1. Abre `apps/admin-dashboard/lib/theme.ts`.
2. Lee la variable de entorno y añade un booleano exportable:
   ```typescript
   export const isNuevoTema = NEXT_PUBLIC_THEME === 'nuevo_tema';
   ```

## 2. Añadir Estilos y Variables Globales en `app/globals.css`

Define las variables CSS y animaciones específicas para el tema. Sigue el patrón existente:

1. Abre `apps/admin-dashboard/app/globals.css`.
2. Añade las clases utilitarias, ej:
   ```css
   .glow-card-nuevo_tema {
     /* Box shadow o fondos específicos */
   }
   .neon-text-nuevo_tema {
     /* Texto con sombras */
   }
   ```

## 3. Inyectar Variables CSS en el Layout Raíz

Para que el tema modifique fuentes u otros aspectos estructurales a nivel DOM:

1. Abre `apps/admin-dashboard/app/layout.tsx`.
2. En el elemento `<body>`, añade las condiciones:
   ```tsx
   <body className={`... ${isNuevoTema ? 'font-mono' : 'font-sans'}`}>
   ```

## 4. Adaptar Componentes Clave

Busca los lugares donde se usan operadores ternarios para los temas actuales (`isFrankTheme`, `isRafaTheme`) y añade la condición de tu nuevo tema.

Archivos principales a revisar:
- **`app/page.tsx`** (Landing page): Revisa fondos, gradients y elementos visuales (ej: `<Cpu />`, bordes).
- **`app/admin/layout.tsx`** (Estructura interna): Sidebar, navbar y alertas de sesión.
- **`app/admin/p2p/page.tsx`** (Dashboard P2P): Tablas, cards, botones y componentes modales.

> [!TIP]
> **Convención:** Utiliza operadores ternarios anidados o interpolación estricta para asegurar que cada tema randerice sus clases exactas:
> `` className={`${isFrankTheme ? 'bg-orange-500' : isRafaTheme ? 'bg-emerald-500' : isNuevoTema ? 'bg-blue-500' : 'bg-slate-500'}`} ``

## 5. Pruebas Locales

Para probar tu tema localmente:
1. Abre (o crea) el archivo `.env` en `apps/admin-dashboard/`.
2. Cambia el valor:
   ```env
   NEXT_PUBLIC_THEME=nuevo_tema
   ```
3. Reinicia el servidor de desarrollo y verifica que no existan remanentes de los colores de otros temas (naranja, verde, etc.) en tus componentes.
