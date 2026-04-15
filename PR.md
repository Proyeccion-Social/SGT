# Descripción

Los parámetros de negocio de atlas-sgt estaban hardcodeados en ~11 ubicaciones del código (24h de cancelación, 30min por slot, 8h semanales por defecto, etc.). Esto impedía ajustarlos sin hacer un redeploy.

Este PR implementa un módulo global `ExternalConfigModule` que centraliza estos valores en un archivo JSON (`config/business-config.json`) con cache en memoria. El admin puede consultarlos y modificarlos vía API REST sin necesidad de redeploy.

### Cambios principales

**Nuevo módulo `src/modules/external-config/`:**
- `ExternalConfigService`: carga el JSON al arrancar (`onModuleInit`), expone `getConfig()` y `updateConfig()`. Si el archivo no existe lo crea con defaults; si está corrupto usa los defaults sin romper el arranque.
- `ExternalConfigController`: endpoints `GET /admin/config` y `PATCH /admin/config` protegidos con `JwtAuthGuard + RolesGuard + ADMIN`.
- Interfaz `BusinessConfig` con 4 secciones: `scheduling`, `notifications`, `availability`, `tutor`.
- Valores por defecto en `business-config.defaults.ts` que replican exactamente los valores anteriores.

**Refactorización de valores hardcodeados:**

| Archivo | Valor anterior | Ahora |
|---------|---------------|-------|
| `session-validation.service.ts` | `>= 24` (horas para cancelar) | `>= config.scheduling.cancellation_notice_hours` |
| `session.service.ts` | `addDays(new Date(), 1)` (expiración modificación) | `addHours(new Date(), config.scheduling.modification_expiry_hours)` |
| `session.service.ts` | `@IsIn([1, 1.5, 2])` estático en DTO | Validación dinámica en servicio contra `config.scheduling.allowed_duration_hours` |
| `notifications.service.ts` | `24 * 60 * 60 * 1000` (expiración confirmación) | `config.notifications.confirmation_expiry_hours * 60 * 60 * 1000` |
| `availability.service.ts` | `SLOT_DURATION_MINUTES = 30`, `MAX_SLOTS_PER_DAY = 8` | Computed getters desde `config.availability` |
| `tutor.service.ts` | `?? 8` (límite semanal por defecto) | `?? config.tutor.default_weekly_hours_limit` |
| `complete-tutor-profile.dto.ts` | `@Min(1) @Max(40)` estáticos | `@IsPositive()` + validación de rango en servicio |

## Tipo de cambio
- [ ] Bug fix (arreglo de error)
- [x] Nueva funcionalidad
- [ ] Cambio breaking (cambio que requiere ajustes en otras partes)
- [ ] Mejora de rendimiento
- [x] Refactorización (sin cambios funcionales)
- [ ] Documentación

## ¿Cómo se probó?
- [ ] Tests unitarios
- [ ] Tests de integración
- [x] Pruebas manuales

**Escenarios manuales a verificar:**
1. Arrancar app sin `config/business-config.json` → se crea automáticamente con defaults, app inicia sin errores.
2. `GET /admin/config` → retorna el JSON con todos los valores actuales.
3. `PATCH /admin/config` con valores válidos → actualiza archivo y cache, responde el config actualizado.
4. `PATCH /admin/config` con valores inválidos (ej. `cancellation_notice_hours: 0`) → responde `400 Bad Request` con mensajes descriptivos.
5. Corromper manualmente el JSON y reiniciar → app arranca con defaults, log de warning visible.
6. Flujo existente de cancelación de sesión y creación de sesión → funciona igual que antes con los valores por defecto.

## Checklist
- [x] Mi código sigue las guías de estilo del proyecto
- [ ] Actualicé la documentación correspondiente
- [ ] Los tests pasan localmente
- [x] No hay conflictos con la rama principal
