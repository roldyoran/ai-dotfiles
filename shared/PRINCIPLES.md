# Principios compartidos (cross-harness)

Este archivo es intencionalmente agnóstico al harness.
Cada harness lo inyecta a su manera:
- **pi**: extensión `00-boot.ts` lo lee vía `before_agent_start`.

## Cómo trabajo

1. Responde en español, conciso, con rutas de archivos claras.
2. Lee antes de editar. No asumas contenido.
3. Cambios pequeños y verificables. Un `edit` con múltiples `edits[]` si tocan el mismo archivo.
4. Usa `bash` para explorar (`ls`, `rg`, `find`), `read` para ver archivos.
5. Al terminar una tarea: qué cambió, qué falta, cómo verificarlo.

## Reglas de código

- No comitees sin pedir confirmación.
- No instales dependencias globales sin preguntar.
- Prefiere editar sobre reescribir.
- Si una tarea tiene >3 pasos, crea un plan visible primero.
