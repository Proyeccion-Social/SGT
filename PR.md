# Descripción

El proyecto tenía 2 módulos con tests unitarios sobre 12. Este PR implementa la política de testing completa para la capa de servicios, configura el pipeline de CI/CD y corrige 7 bugs encontrados durante el proceso.

### Cambios principales

**Tests unitarios — 283 casos en 14 archivos nuevos:**

| Módulo | Archivo | Tests |
|--------|---------|-------|
| auth | `auth.service.spec.ts` | 22 |
| auth | `email-verification.service.spec.ts` | 6 |
| auth | `password-reset.service.spec.ts` | 6 |
| users | `users.service.spec.ts` | 37 |
| student | `student.service.spec.ts` | 7 |
| subjects | `subjects.service.spec.ts` | 20 |
| app-notification | `app-notifications.service.spec.ts` | 13 |
| session-execution | `attendance.service.spec.ts` | 16 |
| session-execution | `evaluation.service.spec.ts` | 14 |
| scheduling | `session-validation.service.spec.ts` | 16 |
| scheduling | `session.service.spec.ts` | 42 |
| scheduling | `dashboard.service.spec.ts` | 6 |
| notifications | `notifications.service.spec.ts` | 29 |

Los tests de `session.service` cubren los escenarios de mayor riesgo: doble reserva por condición de carrera, auto-rechazo en cascada al confirmar sesión, regla de 24h para cancelación, expiración de solicitudes de modificación y re-validación de disponibilidad al aceptar cambios.

**CI/CD — `.github/workflows/ci.yml`:**

Pipeline que corre en cada PR hacia `main` o `develop`:
```
Checkout → Setup Node 22 → npm ci → Lint → Build → Test + Coverage
```
Sube el reporte de coverage como artifact (7 días de retención).

**Configuración — `package.json` y `.npmrc`:**
- Umbrales de coverage: statements/lines ≥ 30%, branches ≥ 25%, functions ≥ 25%
- Exclusión de DTOs/entities/enums del cálculo de coverage
- Registry público de npm para que `npm ci` funcione fuera de la red de Fury

**Lint — `eslint.config.mjs`:**
- Reglas `unsafe-*` bajadas a `warn` globalmente (el codebase preexistente no cumplía con `recommendedTypeChecked`)
- Override para spec files: `no-unsafe-*`, `require-await` y `unbound-method` apagados (usar `any` en mocks de Jest es idiomático)

**Bugs corregidos en código fuente:**

| Archivo | Bug |
|---------|-----|
| `notifications.service.ts` | `calculateNewEndTime` no aplicaba `% 24`, producía `'24:30'` al cruzar medianoche |
| `session-validation.service.ts` | `validateStudentNotTutor` era `async` sin ningún `await` |
| `session.service.ts` | `await` sobre llamada síncrona a `validateStudentNotTutor` |
| `evaluation.service.ts` | Comparaciones de enum con strings literales (`'ATTENDED'`, `'INDIVIDUAL'`) |
| `availability.controller.ts` | Declaraciones léxicas en bloques `case` sin llaves |
| `notifications.service.ts` | `throw error` lanzaba objeto Resend en lugar de `Error` |
| `auth.module.ts` | `useFactory` marcado como `async` sin ningún `await` |

## Tipo de cambio
- [x] Bug fix (arreglo de error)
- [x] Nueva funcionalidad
- [ ] Cambio breaking (cambio que requiere ajustes en otras partes)
- [ ] Mejora de rendimiento
- [ ] Refactorización (sin cambios funcionales)
- [ ] Documentación

## ¿Cómo se probó?
- [x] Tests unitarios — `npm test` pasa 283/283 localmente
- [ ] Tests de integración
- [ ] Pruebas manuales

## Checklist
- [x] Mi código sigue las guías de estilo del proyecto
- [x] Los tests pasan localmente
- [x] No hay conflictos con la rama principal
