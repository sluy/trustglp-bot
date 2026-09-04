# 🏛️ Plan de Acción Arquitectónico: Plataforma Automatizada P2P Binance (USDT/VES)

**Visión de Negocio:** Construir un sistema modular, escalable y tolerante a fallos para la automatización total del comercio P2P en Binance (USDT/VES). El sistema no solo monitoreará el mercado, sino que gestionará el capital, publicará y ajustará anuncios dinámicamente, auditará pagos bancarios mediante integraciones externas y maximizará el ROI operativo.

**Regla Estricta Aplicada:** El Arquitecto Principal/CEO NO escribe código de producción. Este plan está estructurado para que el equipo de desarrolladores ejecute cada paso de forma atómica y auditable.

**Arquitectura Seleccionada (Enterprise-Grade):**
- **Core y Servicios (Backend):** Arquitectura orientada a microservicios.
  - *Market Data & P2P Scanner:* Python (FastAPI). Ideal para scraping inteligente, manejo de websockets y procesamiento de matrices de datos del mercado P2P.
  - *Order & Payment Manager:* TypeScript (Node.js con NestJS). Escogido por su arquitectura empresarial, inyección de dependencias, tipado estricto y excelente manejo de eventos asíncronos para la gestión transaccional.
- **Base de Datos:** PostgreSQL (para persistencia segura de transacciones financieras y contabilidad) y Redis (para caché agresivo, colas pub/sub y control de latencia en precios en vivo).
- **Panel Administrativo (Control Deck):** React (Next.js) con TailwindCSS y WebSockets para visualización y control manual del centro de mando en tiempo real.
- **Infraestructura:** Docker (contenedores independientes) y un orquestador para facilitar despliegues escalables (Ej. Easypanel, Docker Swarm o Kubernetes a futuro).

---

## 🏗️ Fase 1: Infraestructura y Estructura Base del Monorepo

**Paso 1: Inicialización del Monorepo y Estructura de Directorios**
- Crear la estructura base del proyecto para un monorepo (usando herramientas como Turborepo o carpetas bien definidas).
- Crear los subdirectorios principales: `/services/market-scanner` (Python), `/services/order-manager` (NestJS) y `/apps/admin-dashboard` (Next.js).
- Configurar archivo `docker-compose.yml` unificado para levantar los servicios a nivel local.

**Paso 2: Configuración de Base de Datos y Caché (Infraestructura)**
- Agregar los servicios de infraestructura a `docker-compose.yml`: contenedor para **PostgreSQL** y contenedor para **Redis**.
- Crear el script inicial de migración de base de datos (`init.sql`) para establecer el esquema, tablas principales (vacías por ahora) y roles de usuario.
- Levantar los contenedores básicos para validar la conexión y puertos.

## 🧠 Fase 2: Inteligencia de Mercado - Market Scanner (Python/FastAPI)

**Paso 3: Inicialización del Servicio `market-scanner`**
- Inicializar el entorno virtual de Python dentro de `services/market-scanner`.
- Instalar dependencias core: `fastapi`, `uvicorn`, `redis`, `httpx` (o `aiohttp`), `pydantic`.
- Levantar el esqueleto base de la API, definir variables de entorno, y probar endpoints de `Health Check`.

**Paso 4: Cliente P2P de Binance (Modo Extracción de Datos)**
- Desarrollar un módulo robusto para conectarse a los endpoints públicos de la API P2P de Binance para el par USDT/VES.
- Crear funciones de extracción para obtener la profundidad de mercado (Libro de Órdenes P2P) filtrada por métodos de pago específicos de Venezuela (ej. Pago Móvil, Banesco, Mercantil).

**Paso 5: Motor de Análisis de Spread y Competencia**
- Crear la lógica matemática que calcule en tiempo real: el precio promedio del "top 5" de anuncios de la competencia, el techo y suelo de rentabilidad (Spread), y que detecte vacíos de liquidez (oportunidades).
- Configurar un Worker en background que ejecute este bucle de escaneo a intervalos predefinidos de forma segura para evitar *Rate Limiting* (baneo de IP temporal de Binance).

**Paso 6: Publicación de Telemetría de Mercado en Redis**
- Conectar el servicio `market-scanner` al bus de eventos Redis.
- Configurar la publicación (Pub/Sub) de los datos de mercado filtrados en un canal específico de Redis (ej. `market_updates:usdt_ves`) tras cada actualización exitosa.

## ⚙️ Fase 3: Motor Transaccional - Order Manager (NestJS)

**Paso 7: Inicialización del Servicio `order-manager`**
- Inicializar la aplicación con NestJS dentro de `services/order-manager`.
- Instalar módulos clave: `Prisma` (ORM) para la conexión a PostgreSQL, librerías cliente para Redis (`ioredis`), y módulo de control de configuración (variables de entorno).

**Paso 8: Modelado Relacional Financiero (Base de Datos)**
- Establecer esquemas de Prisma para las tablas críticas: `InventarioCapital` (USDT en exchange vs VES en bancos locales), `AnunciosPropios` (estado actual de nuestros anuncios) y `TransaccionesEjecutadas` (historial exacto).
- Ejecutar migraciones e integrarlas al ORM.

**Paso 9: Lógica Fiduciaria (Gestor de Capital / Bankroll Management)**
- Crear los servicios internos en NestJS para registrar asientos contables (entradas, salidas y bloqueos p2p).
- Programar salvaguardas estrictas: Una regla que impida publicar una orden de venta de USDT si el saldo verificado proyecta una sobre-venta (insuficiencia de volumen propio).

**Paso 10: Estrategia de Retasación Dinámica de Precios (Dynamic Pricing)**
- Conectar `order-manager` a Redis como suscriptor de interrupciones del canal `market_updates:usdt_ves`.
- Desarrollar el algoritmo de ejecución que, al recibir la actualización, calcule la nueva tarifa óptima según los rangos de rentabilidad del usuario, y decida si actualizar o no el precio de los anuncios activos.

**Paso 11: Módulo de Integración con API Privada de Binance P2P**
- Implementar de forma ultra-segura la gestión de API Keys (Secretos).
- Desarrollar el cliente HTTP firmado criptográficamente (HMAC SHA256) necesario para que el sistema emita comandos directos de Trading P2P en la cuenta.
- Proveer la capacidad (API endpoints internos) para publicar anuncios de tipo "Compra" o "Venta", actualizar sus precios y apagarlos.

## 🏦 Fase 4: Conciliación Bancaria y Liberación Automatizada

*Nota del Arquitecto: Este es el entorno de más alto riesgo y recompensa. Para bancos venezolanos (carecen de API abierta) usaremos extracción pasiva (lectura).*

**Paso 12: Módulo Generador y Receptor de Simulación de Pagos**
- Crear un endpoint / webhook temporal en `order-manager` que reciba notificaciones (payloads falsos en la prueba inicial) representando recibos bancarios aprobados (Banco, Monto exacto, Referencia, Cédula/Identidad del emisor).
- Establecer la lógica de conciliación comparando el estado de la "Orden Activa de Binance" contra el "Recibo Bancario" entrante.

**Paso 13: Procedimiento de Liberación Automática Segura (Release Order)**
- Desarrollar la lógica condicional crítica: Únicamente enviar la instrucción POST criptográficamente segura a Binance para presionar "Liberar Crypto" SI Y SOLO SI la conciliación del Paso 12 encuentra una coincidencia exacta de monto fiat asociado a un remitente válido.

## 📊 Fase 5: Centro de Comando (Admin Dashboard Next.js)

**Paso 14: Estructuración del Cliente (Dashboard)**
- Inicializar el entorno frontend con Next.js y un framework moderno de componentes base (como TailwindCSS + Shadcn/UI o equivalentes modulares).
- Proveer las vistas skeleton para: Monitor en Vivo, Balance General, Configuración de Limites/Margen (Settings), y Auditoría de Transacciones.

**Paso 15: Conexión de Datos y Vistas de Auditoría**
- Implementar llamadas para traer y procesar data (Poling o Sockets) desde los diferentes microservicios, consolidándolos para el usuario administrador.
- Crear gráficos de métricas e Indicadores de Estado Visuales que adviertan en rojo anomalías contables o bloqueos de mercado.

**Paso 16: Panel de Acción y Emergencia (Kill Switch)**
- Integrar la botonera principal con autorización estricta: controles forzados para "Pausar Actividad" (Kill limits), que envíe comandos directos de aborto al `order-manager` para clausurar anuncios vigentes en caso de catástrofe de precios o problemas bancarios locales.

## 🚀 Fase 6: Pruebas de Estrés y Auditoría Simulada

**Paso 17: Suite de Pruebas Financieras**
- Desarrollar TDD (Test Driven Development) exclusivamente enfocado en las clases que manejan matemáticas para asegurar la erradicación total del temido "Error de coma flotante" o venta a pérdida.

**Paso 18: Simulación Dry-Run (Papertrading P2P)**
- Crear un mock integral que permita inyectar simulaciones extremas (caída o subida abrupta del VES vs USDT en el mercado monitorizado) y verificar visualmente en el console.log y base de datos si el controlador detiene o ajusta correctamente las operaciones sin disparar la API de Binance real.

---

## 🛑 Fase 7: Correcciones Obligatorias de QA (Agente: Dev Senior-Coder)

*Nota de QA - Tester Estricto: El código actual ha sido **RECHAZADO**. El Dev Senior-Coder DEBE ejecutar atómicamente las siguientes tareas antes de solicitar una nueva revisión.*

**Paso 19: Corrección de Infraestructura Git (Crítico)**
- Inicializar el repositorio Git local en la carpeta raíz `agencia-ia-core`.
- Crear el archivo `.gitignore` (excluyendo `node_modules`, `dist`, `.env`, y bases de datos locales).
- Hacer el commit inicial de la estructura base y los microservicios actuales (`market-scanner` y `order-manager`).
- Sincronizar y subir (Push) a la rama `main` en el repositorio remoto de GitHub entregado por el usuario.

**Paso 20: Refactorización de Seguridad en NestJS (Process.env)**
- Modificar el archivo `services/order-manager/src/binance-p2p.service.ts` eliminando el uso directo de `process.env`.
- Implementar e inyectar el módulo oficial `@nestjs/config` (`ConfigService`) para la lectura segura y validada de variables de entorno (API Keys).

**Paso 21: Implementación de TDD - Riesgo Matemático**
- Cumplir estrictamente con el Paso 17 implementando la suite de pruebas en `services/order-manager/src/capital.service.spec.ts`.
- La prueba debe validar específicamente la precisión matemática y demostrar la mitigación del error de coma flotante en cálculos de capital P2P.

---

## 🤖 Fase 8: Proyecto 2 - Desarrollo de ByBit Grid HMM Bot (Agentes Asignados: Dev Senior Coder, QA & DevOps)

*Nota del CEO: El diseño arquitectónico está definido. El equipo debe ejecutar atómicamente la construcción del nuevo bot cuantitativo para ByBit. Cada agente debe ceñirse a su rol para no solapar responsabilidades.*

**Paso 22: Inicialización del Microservicio (Agente DevOps / Git Manager)**
- Crear el directorio `/services/bybit-grid-bot`.
- Crear el archivo `requirements.txt` incluyendo: `fastapi`, `uvicorn`, `pybit` (Bybit API), `hmmlearn`, `pandas`, `numpy`, `python-telegram-bot` y `python-dotenv`.
- Crear el `Dockerfile` básico de Python 3.10+ para correr el bot.
- Añadir el servicio `bybit-grid-bot` al `docker-compose.yml` de la raíz del monorepo, incluyendo la lectura del archivo `.env` para las APIs.

**Paso 23: Lógica Base del Bot y Conexión API (Agente Dev Senior Coder)**
- Desarrollar `main.py` para inicializar el bot y arrancar el ciclo de vida asíncrono.
- Desarrollar `bybit_client.py` usando `pybit` (HTTP y Websockets) para conectarse a la V5 de Bybit (Mercado Lineal Perpetuo USDT), con funciones para: leer precio BTC/USDT, colocar órdenes límite (buy/sell), cancelar órdenes, y establecer apalancamiento a 3x.
- Proveer validaciones estrictas de error-handling usando try-catch y logging.

**Paso 24: Motor HMM y Estrategia Grid Pionex-Style (Agente Dev Senior Coder & QA Tester)**
- Desarrollar `hmm_engine.py` para procesar OHLCV histórico (Dataframe de pandas usando Bybit API), entrenar/evaluar el mercado y retornar el régimen actual matemático (ej. Tendencia Alcista, Lateralización, Tendencia Bajista).
- Desarrollar `grid_strategy.py` emulando el comportamiento del famoso "Pionex Grid", con $10,000 USDT de capital base simulado y 3x Leverage (Poder total $30,000). 
- *Lógica de Riesgo:* Activar las mallas paramétricas (Top y Bottom limits) **solo** cuando `hmm_engine` indique "Lateralización", y abortar las operaciones suspendiendo el grid si se detecta un cambio hacia una tendencia fuerte prolongada.

**Paso 25: Módulo de Autocontrol y Reportes Telegram (Agente Dev Senior Coder)**
- Desarrollar `telegram_reporter.py` para emitir mensajes estructurados tipo Push al smartphone del Administrador/Usuario usando un Bot de Telegram y `python-telegram-bot`.
- El bot debe enviar un resumen programado (cada 24 horas) detallando: PnL Diario Realizado, PnL No Realizado, Régimen HMM Detectado hoy, y alertas críticas de emergencia o status del Grid.
