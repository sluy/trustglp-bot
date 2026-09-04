---
description: Flujo completo de orquestación de Agentes IA (CEO -> Dev -> QA -> Loop)
---

# Workflow: Desarrollo Completo

Este workflow garantiza la ejecución de cualquier plan de acción utilizando el marco de responsabilidad distribuida entre tres agentes clave: **CEO / Arquitecto**, **Desarrollador / Dev**, y **Control de Calidad (QA)**.

Si el `plan_de_accion.md` no existe aún, el agente CEO debe generarlo basándose en los requisitos del sistema, desglosando el trabajo en "Pasos" granulares y concisos.

**Flujo de Ejecución por Paso:**

1. **Planificación y Asignación (Agente 1 - CEO):** 
   - Analiza el `plan_de_accion.md`.
   - Llama al **Agente 2 (Dev)** (mediante `@Dev` interactivamente o simulado en el flujo) ordenando ejecutar el siguiente paso pendiente: *"@Dev - Senior Coder, el plan está listo. Procede a ejecutar el Paso X"*.

2. **Ejecución y Despliegue (Agente 2 - Dev):**
   - El Dev escribe, modifica o crea los archivos correspondientes a ese único Paso de manera atómica, aplicando las mejores prácticas de código y registrándolos en el directorio correcto.
   - Da aviso de terminación a CEO/QA.

3. **Revisión y Strict Testing (Agente 3 - QA):**
   - El CEO invoca a QA: *"@QA - Tester Estricto, revisa el código recién implementado para el Paso X"*.
   - El Agente QA analiza la lógica del paso y evalúa exhaustivamente buscando fugas de seguridad, casos de borde no contemplados (ej: sobreventas en P2P), y fallos sintácticos. 

4. **Bucle de Iteración (Feedback Loop):**
   - **Caso A (Fallo):** Si QA encuentra debilidades, reporta exactamente la línea y el fallo al Dev. Se fuerza al Dev a repetir o corregir el código del paso indicado, y el Agente QA vuelve a auditar la corrección. Este loop no se rompe hasta que el código es robusto.
   - **Caso B (Éxito):** QA declara el código "listo para producción" (o emitir Aprobación de QA). El CEO levanta una bandera de éxito sobre ese paso en particular en el `task.md`.

5. **Avanzando:** El equipo (CEO -> Dev -> QA) repite sistemáticamente el ciclo en el **Paso X+1** hasta finalizar todas las fases.

**Nota para el CEO:** Todo este proceso debe ocurrir en "background", sin requerir la intervención en cada iteración del usuario humano, quien será notificado de los progresos del desarrollo completo.
