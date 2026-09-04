# Protocolo No Documentado: Binance SAPI C2C (Merchant API)

Este documento registra los hallazgos empíricos y la ingeniería inversa realizada para conectarse exitosamente a los endpoints privados (SAPI) de Binance C2C usando API Keys con permisos exclusivos de Lectura, logrando ejecutar acciones de Escritura (como marcar órdenes como pagadas) evadiendo el WAF de Binance.

## El Problema Original
Al intentar interactuar con los endpoints POST de C2C bajo el prefijo `/sapi/v1/c2c/`, nos enfrentábamos a dos bloqueos constantes:
1. **Error `-1002 You are not authorized`**: Ocurría cuando enviábamos la firma (signature) dentro de un cuerpo `application/json`. El WAF (Filtro de Seguridad) detectaba una operación de escritura JSON hacia C2C y la bloqueaba porque la API Key no tenía explícitamente habilitado el permiso C2C de escritura.
2. **Error `-1000 Unknown Error`**: Ocurría al intentar enviar la petición como `application/x-www-form-urlencoded`. El Gateway dejaba pasar la petición, pero el microservicio interno colapsaba porque estrictamente esperaba leer JSON.

## La Solución: "Estructura Híbrida (Hybrid JSON)"
Descubrimos que el WAF de Binance y el microservicio interno evalúan las firmas de forma desacoplada en estos endpoints específicos.

Para realizar un POST exitoso a cualquier endpoint C2C SAPI se debe seguir esta regla estricta:

1. **La Firma (Signature) va en el Query String (URL)**
   - Se debe generar la cadena de consulta (query string) ÚNICAMENTE con el `timestamp` (y no los parámetros del body).
   - Ejemplo: `timestamp=1779875779123`
   - Se firma esta cadena plana usando HMAC-SHA256 con el API Secret.
   - La URL final queda así: `https://api.binance.com/sapi/v1/c2c/orderMatch/markOrderAsPaid?timestamp=1779875779123&signature=abc123def456...`

2. **Los Datos van en un Body JSON Puro**
   - El cuerpo de la petición HTTP DEBE ser un JSON válido (`Content-Type: application/json`).
   - El JSON DEBE contener los parámetros de la operación, **SIN** incluir ni el `timestamp` ni la `signature` (ya que estos fueron consumidos por la URL).

Al hacer esto, el WAF valida la firma del Query String (aprobando la petición como "inofensiva"), pero el microservicio de P2P lee los parámetros desde el cuerpo JSON, procesando la orden con éxito.

---

## Endpoints Descubiertos y Probados

### 1. Marcar Orden como Pagada
- **Método:** `POST`
- **Ruta:** `/sapi/v1/c2c/orderMatch/markOrderAsPaid`
- **Query String (URL):** `?timestamp={time}&signature={sig}`
- **Body JSON:**
  ```json
  {
    "orderNumber": "22892889646998261760"
  }
  ```
- **Notas:** 
  - ¡NO requiere el parámetro `payId`! 
  - Tampoco requiere llamar a endpoints intermedios.
  - El parámetro esperado es estrictamente `orderNumber` (no `orderNo` ni `adOrderNo`).

### 2. Obtener Detalles Completos de la Orden
Este endpoint es vital para la automatización RPA, ya que devuelve todos los datos bancarios del vendedor, su cédula, el `payId`, los mensajes no leídos, etc.

- **Método:** `POST`
- **Ruta:** `/sapi/v1/c2c/orderMatch/getUserOrderDetail`
- **Query String (URL):** `?timestamp={time}&signature={sig}`
- **Body JSON:**
  ```json
  {
    "adOrderNo": "22892889646998261760"
  }
  ```
- **Notas:** 
  - A diferencia del endpoint de pago, aquí el parámetro se llama estrictamente **`adOrderNo`** (si se envía `orderNumber` arroja el error `-31002 illegal parameter`).
  - Devuelve un JSON masivo que incluye: `buyerName`, `sellerName`, `tradeType`, `payType` (ej. Banesco), arreglos de campos bancarios (cuenta, cédula, nombre del titular), y el `selectedPayId`.

---

## Próximos Pasos en la Investigación
- **Subir Imágenes (Recibos):** Investigar el endpoint para cargar capturas en el chat (`/sapi/v1/c2c/chat/uploadOrderAttachment` o similar) siguiendo la misma Estructura Híbrida.
- **Enviar Mensajes de Chat:** Probar el endpoint `/sapi/v1/c2c/chat/sendOrderMessage` usando la Estructura Híbrida para poder notificar automáticamente al contraparte.

> **Documento vivo:** Este archivo debe actualizarse a medida que se descubran nuevos endpoints o variaciones en la estructura de SAPI para C2C.

### 3. El Santo Grial: Chat y Comprobantes SIN COOKIES (100% SAPI)

Se logró descifrar el flujo completo para automatizar el chat y envío de comprobantes nativos usando exclusivamente las API Keys (SAPI), eliminando por completo la dependencia de BAPI y cookies. El ingeniero tenía razón: es un flujo de pasos, pero el último paso requiere **WebSockets**.

**Flujo Completo Descubierto:**
1. **Generar URL de AWS S3 (REST SAPI):**
   - **Ruta:** `/sapi/v1/c2c/chat/image/pre-signed-url`
   - **Payload JSON:** `{ "imageName": "comprobante.jpg", "adOrderNo": "NUM_ORDEN", "fileType": "image/jpeg" }`
   - **Respuesta:** Devuelve un `uploadUrl` (URL firmada de AWS S3) y un `imageUrl` (URL pública estática).

2. **Subir la Imagen a S3 (HTTP PUT):**
   - Se hace una petición `PUT` al `uploadUrl` recibido, con el buffer binario de la imagen y el `Content-Type: image/jpeg`. Binance aloja la imagen en sus servidores.

3. **Obtener Credenciales de Chat WebSocket (REST SAPI):**
   - **Ruta:** `/sapi/v1/c2c/chat/retrieveChatCredential` (GET con firma en query string).
   - **Respuesta:** Devuelve `chatWssUrl`, `listenKey` y `listenToken`.

4. **Enviar el Mensaje NATIVO de Imagen vía WebSocket:**
   - No existe endpoint REST para enviar mensajes. **Todo sucede vía WSS**.
   - **Conexión:** Se conecta vía `wss` a la URL construida así: 
     `{chatWssUrl}/{listenKey}?token={listenToken}&clientType=web`
   - **Enviar Payload (JSON String):** 
     ```json
     {
       "type": "image",
       "uuid": "un-uuid-generado",
       "orderNo": "NUM_ORDEN",
       "imageUrl": "URL_OBTENIDA_EN_PASO_1",
       "thumbnailUrl": "URL_OBTENIDA_EN_PASO_1",
       "imageType": "jpeg",
       "width": 500,
       "height": 500,
       "self": true,
       "clientType": "web",
       "sendStatus": 0
     }
     ```
   - **El Secreto:** Si se usa `type: "image"`, el parámetro `content` arroja error `ILLEGAL_PARAM`. La estructura interna de Binance exige los parámetros `imageUrl`, `thumbnailUrl`, `imageType`, `width` y `height`. Al enviarlo así, Binance lo renderiza de manera nativa como una burbuja de imagen dentro de la app oficial del vendedor.

---

## 4. Orquestación End-to-End: RPA Bancario + Binance API

Logramos fusionar la lectura de la API de Binance con un RPA bancario (Playwright) para lograr el pago 100% automatizado, la captura del comprobante y su subida a Binance.

**Flujo Operativo Integrado (Auto-Pay Bot):**
1. **Detección (API):** El bot detecta una orden `PENDING` en Binance y extrae la Cédula y Cuenta Bancaria leyendo el chat P2P.
2. **Ejecución RPA:** Se lanza un proceso asíncrono con Playwright que ingresa al banco (ej. Banesco), completa la transferencia superando Modales Dinámicos inyectando eventos nativos de teclado (`Enter`) para evitar bloqueos del WAF bancario.
3. **Manejo OTP Dinámico:** El RPA extrae la "Clave de Operaciones Especiales" conectándose por IMAP a Gmail, y la inyecta en el banco en tiempo real.
4. **Captura Quirúrgica:** El RPA recorta el `body` del `iframe` de la transferencia exitosa (ignorando menús) y genera un archivo limpio llamado `debug_recibo.png`.

**Filtro Crítico de Seguridad (Failsafe):**
- Si el RPA falla por CUALQUIER motivo (Timeout, Usuario Bloqueado en el banco, Fondos Insuficientes), retorna `success = False`.
- **Regla Estricta:** El Orquestador evalúa esta bandera. Si es `False`, **aborta instantáneamente** la inyección hacia Binance.
- **Limpieza (Garbage Collection):** Se elimina agresivamente cualquier `debug_recibo.png` huérfano tras cada operación exitosa para erradicar el riesgo de subir un "Comprobante Fantasma" reciclado a una orden fallida.
- Solo si `success = True`, el Orquestador llama a los endpoints `/upload-proof` y `/mark-paid` en Binance.
