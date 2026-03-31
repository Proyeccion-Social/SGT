# Functional Specification - external-business-config

**Feature**: feat-001-external-business-config
**Version**: 1.0.0
**Fecha**: 2026-03-31
**Estado**: Borrador

---

## Problem Statement

Actualmente los parametros de negocio del sistema atlas-sgt estan hardcodeados en el codigo fuente. Valores como las horas de confirmacion de tutoria (24h), limites de cancelacion, duraciones permitidas de sesion, umbrales de alerta de horas del tutor, entre otros, requieren un redeploy completo para ser modificados.

Esto genera:
- **Rigidez operativa**: Cambiar un parametro simple (ej: de 24h a 12h para propuestas de modificacion) requiere intervenir el codigo.
- **Riesgo de errores**: Los valores estan dispersos en multiples archivos y servicios, sin una fuente unica de verdad.
- **Dependencia del equipo de desarrollo**: El admin no puede ajustar parametros de negocio de forma autonoma.

---

## Objectives

1. Centralizar los parametros de negocio en una fuente unica configurable (archivo JSON)
2. Permitir al admin modificar configs via API sin redeploy, con validacion estricta
3. Garantizar que el sistema no falle si el archivo de config se pierde o corrompe (auto-regeneracion con defaults)

---

## Success Metrics

| Metrica | Objetivo |
|---------|----------|
| Valores hardcodeados migrados | 100% de los parametros de alta prioridad externalizados |
| Tiempo de cambio de config | De ~30 min (redeploy) a < 1 min (PATCH request) |
| Resiliencia | Sistema arranca correctamente sin archivo JSON (regenera defaults) |

---

## Scope

### In Scope

- Archivo JSON como fuente de verdad para parametros de negocio
- Cache en memoria (singleton) para acceso rapido
- Endpoint `GET /admin/config` para consultar configuracion actual (solo ADMIN)
- Endpoint `PATCH /admin/config` para actualizar parametros (solo ADMIN)
- Validacion estricta de valores en el PATCH (rangos, tipos, formatos)
- Auto-regeneracion del archivo JSON con valores por defecto si no existe o esta corrupto
- Refactorizacion de los servicios existentes para consumir configs del cache en lugar de valores hardcodeados

### Out of Scope

- **Configs de seguridad**: bcrypt rounds, JWT secrets, tiempos de expiracion de tokens
- **Configs de infraestructura**: variables de entorno (DB_HOST, PORT, etc.)
- **UI del dashboard**: Esta feature cubre solo el backend/API; el frontend es otra feature
- **Historial de cambios/auditoria**: No se registra quien cambio que (mejora futura)
- **Configs de baja prioridad**: Solo se externalizan los parametros de alta prioridad de negocio

---

## User Stories

### US-1: Consultar configuracion actual

**Priority**: Medium

**As a** admin del sistema,
**I want** consultar los parametros de negocio configurados actualmente,
**So that** pueda verificar los valores vigentes antes de realizar cambios.

### Acceptance Criteria

- CA-1.1: El endpoint `GET /admin/config` devuelve el JSON completo de configuracion
- CA-1.2: Solo usuarios con rol ADMIN pueden acceder al endpoint
- CA-1.3: La respuesta refleja los valores actuales en memoria (cache)

### US-2: Actualizar parametros de negocio

**Priority**: High

**As a** admin del sistema,
**I want** modificar uno o mas parametros de negocio via API,
**So that** pueda ajustar el comportamiento del sistema sin necesidad de redeploy.

### Acceptance Criteria

- CA-2.1: El endpoint `PATCH /admin/config` acepta un body JSON parcial con solo los campos a modificar
- CA-2.2: Los valores enviados se validan estrictamente antes de aplicar:
  - Tipos de datos correctos (numeros, arrays, objetos)
  - Rangos validos (ej: `session_confirmation_hours` entre 1 y 72)
  - Arrays no vacios donde se requieran (ej: `allowed_session_durations`)
  - Valores positivos donde corresponda
- CA-2.3: Si la validacion falla, se retorna error 400 con detalle del campo y restriccion violada
- CA-2.4: Si la validacion pasa, se actualiza el archivo JSON en disco Y el cache en memoria atomicamente
- CA-2.5: Solo usuarios con rol ADMIN pueden ejecutar el PATCH
- CA-2.6: La respuesta incluye la configuracion completa actualizada

### US-3: Carga automatica de configuracion al arrancar

**Priority**: High

**As a** sistema backend,
**I want** cargar la configuracion desde el archivo JSON al iniciar la aplicacion,
**So that** todos los servicios consuman valores configurables desde el primer request.

### Acceptance Criteria

- CA-3.1: Al arrancar, el sistema lee el archivo JSON de configuracion
- CA-3.2: Si el archivo no existe, se crea automaticamente con valores por defecto (los mismos valores hardcodeados actuales)
- CA-3.3: Si el archivo existe pero esta corrupto (JSON invalido), se reemplaza con valores por defecto y se registra un warning en logs
- CA-3.4: Los valores se almacenan en un cache en memoria (singleton) accesible por todos los servicios
- CA-3.5: Los servicios existentes consumen valores del cache en lugar de valores hardcodeados

### US-4: Consumo de configuracion por servicios existentes

**Priority**: High

**As a** sistema backend,
**I want** que los servicios de scheduling, availability, tutor y notifications consuman los parametros desde la configuracion centralizada,
**So that** los cambios del admin se reflejen inmediatamente en el comportamiento del sistema.

### Acceptance Criteria

- CA-4.1: `session-validation.service.ts` usa `cancellation_notice_hours` del config en lugar de 24 hardcodeado
- CA-4.2: `notifications.service.ts` usa `session_confirmation_hours` del config en lugar de 24 hardcodeado
- CA-4.3: `session.service.ts` usa `modification_request_expires_hours` del config en lugar de 24 hardcodeado
- CA-4.4: `create-individual-session.dto.ts` usa `allowed_session_durations` del config en lugar de `[1, 1.5, 2]` hardcodeado
- CA-4.5: `availability.service.ts` usa `slot_duration_minutes` y `max_slots_per_day` del config
- CA-4.6: `tutor.service.ts` y `complete-tutor-profile.dto.ts` usan `min_weekly_hours`, `max_weekly_hours`, `default_weekly_hours` del config
- CA-4.7: `notifications.service.ts` usa `hour_limit_thresholds` del config para los umbrales de alerta
- CA-4.8: `notifications.service.ts` usa `reminder_hours_before` del config para los tiempos de recordatorio

---

## User Experience

### Flujo principal (Admin actualiza config)

1. Admin se autentica con JWT (rol ADMIN)
2. Admin hace `GET /admin/config` para ver valores actuales
3. Admin hace `PATCH /admin/config` con los campos a modificar
4. Sistema valida los valores recibidos
5. Si es valido: actualiza archivo JSON + cache, retorna config completa
6. Si es invalido: retorna error 400 con detalle de validacion
7. Los servicios del sistema usan los nuevos valores inmediatamente

### Flujo de arranque

1. Sistema inicia
2. Busca archivo JSON de configuracion en la ruta configurada
3. Si existe y es valido: carga en cache
4. Si no existe: crea archivo con defaults, carga en cache
5. Si existe pero esta corrupto: reemplaza con defaults, registra warning, carga en cache

---

## Estructura de Configuracion

El archivo JSON contiene los siguientes parametros de alta prioridad:

```json
{
  "scheduling": {
    "session_confirmation_hours": 24,
    "cancellation_notice_hours": 24,
    "modification_proposal_deadline_hours": 24,
    "modification_request_expires_hours": 24,
    "allowed_session_durations": [1, 1.5, 2],
    "reminder_hours_before": [24, 2]
  },
  "availability": {
    "slot_duration_minutes": 30,
    "max_slots_per_day": 8,
    "max_daily_hours": 4
  },
  "tutor": {
    "min_weekly_hours": 1,
    "max_weekly_hours": 40,
    "default_weekly_hours": 8
  },
  "notifications": {
    "hour_limit_thresholds": {
      "warning": 80,
      "urgent": 95,
      "critical": 100
    }
  }
}
```

---

## Business Rules

### RN-C01: Valores por defecto

Los valores por defecto del JSON son exactamente los valores actualmente hardcodeados en el codigo. Esto garantiza que el comportamiento del sistema no cambie al desplegar la feature.

### RN-C02: Validacion estricta en PATCH

| Parametro | Tipo | Restriccion |
|-----------|------|-------------|
| `scheduling.session_confirmation_hours` | number | 1 - 72 |
| `scheduling.cancellation_notice_hours` | number | 1 - 72 |
| `scheduling.modification_proposal_deadline_hours` | number | 1 - 72 |
| `scheduling.modification_request_expires_hours` | number | 1 - 72 |
| `scheduling.allowed_session_durations` | number[] | Cada valor > 0, array no vacio |
| `scheduling.reminder_hours_before` | number[] | Cada valor > 0, array no vacio |
| `availability.slot_duration_minutes` | number | 15, 30, 45, o 60 |
| `availability.max_slots_per_day` | number | 1 - 20 |
| `availability.max_daily_hours` | number | 1 - 12 |
| `tutor.min_weekly_hours` | number | 1 - max_weekly_hours |
| `tutor.max_weekly_hours` | number | min_weekly_hours - 168 |
| `tutor.default_weekly_hours` | number | min_weekly_hours - max_weekly_hours |
| `notifications.hour_limit_thresholds.warning` | number | 1 - urgent |
| `notifications.hour_limit_thresholds.urgent` | number | warning - critical |
| `notifications.hour_limit_thresholds.critical` | number | urgent - 100 |

### RN-C03: Actualizacion parcial (Deep Merge)

El PATCH acepta actualizacion parcial. Ejemplo: enviar solo `{"scheduling": {"session_confirmation_hours": 12}}` modifica ese valor sin afectar los demas.

### RN-C04: Consistencia cache-disco

Toda escritura exitosa al archivo JSON debe reflejarse inmediatamente en el cache en memoria. No debe haber ventana de inconsistencia.

### RN-C05: Resiliencia al arranque

Si el archivo JSON no existe o esta corrupto, el sistema DEBE arrancar correctamente usando valores por defecto y regenerar el archivo.

---

## Dependencies

| Dependencia | Tipo | Descripcion |
|-------------|------|-------------|
| Servicios existentes | Interna | session-validation.service, session.service, notifications.service, availability.service, tutor.service |
| Sistema de archivos | Infraestructura | Acceso de lectura/escritura al directorio de configuracion en el servidor |
| Guards existentes | Interna | JwtAuthGuard + RolesGuard para proteger endpoints de admin |

---

## Risks

| ID | Riesgo | Probabilidad | Impacto | Mitigacion |
|----|--------|--------------|---------|------------|
| R-1 | Permisos de escritura en el servidor | Media | Alto | Verificar permisos del directorio al arrancar, fallback a defaults |
| R-2 | Valores invalidos que rompan logica de negocio | Baja | Alto | Validacion estricta con rangos definidos en RN-C02 |
| R-3 | DTOs con validacion dinamica | Media | Medio | Los DTOs que usen valores del config deben re-validar contra el config actual |

---

## Critical E2E Test Scenarios

> E2E tests omitidos (proyecto tipo MVP). Los escenarios criticos se cubren con tests unitarios e integracion.
