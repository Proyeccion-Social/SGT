# Phase 2: DOCUMENTATION_GAPS.md
## SGT (Sistema de Gestion de Tutorias) - Analisis de Cobertura Documental

**Fecha de generacion**: 2026-03-31
**Repositorio**: atlas-sgt
**Branch**: `feature/add-external-config-edition`
**Metodo**: Comparacion codigo fuente vs documentacion existente (CODE-ONLY extraction, sin FuryMCP)

---

## 1. Inventario de Documentacion Existente

| Documento | Ruta | Estado | Confiabilidad |
|-----------|------|--------|---------------|
| README.md | `/README.md` | CONFLICTO MERGE sin resolver | BAJA - Inutilizable |
| DATABASE_SETUP.md | `/DATABASE_SETUP.md` | Parcialmente actualizado | MEDIA |
| PROJECT.md | `/meli/PROJECT.md` | Generado por meli-explorer | ALTA |
| PULL_REQUEST_TEMPLATE.md | `/.github/PULL_REQUEST_TEMPLATE.md` | Presente | ALTA |

### 1.1 Documentos Ausentes (no existen en el repositorio)

- `ARCHITECTURE.md` - No existe documentacion de arquitectura
- `API.md` o especificacion OpenAPI/Swagger - No existe documentacion de API
- `CONTRIBUTING.md` - No existe guia de contribucion
- `.env.example` - No existe archivo de ejemplo de variables de entorno
- `CHANGELOG.md` - No existe registro de cambios
- Diagramas de entidad-relacion - No existen
- Documentacion de flujos de negocio - No existe
- Documentacion de roles y permisos - No existe

---

## 2. Analisis de Cobertura por Area

### 2.1 Cobertura de Arquitectura

| Aspecto | Documentado | En codigo | Cobertura |
|---------|-------------|-----------|-----------|
| Modulos del sistema (11) | 0 | 11 | **0%** |
| Patron arquitectonico (NestJS modular) | 0 | 1 | **0%** |
| Conexion de base de datos | Parcial en DATABASE_SETUP.md | 1 activa + 1 comentada | **40%** |
| Estrategia de autenticacion (JWT + Passport) | 0 | Implementado | **0%** |
| Prefijo global de API (`api/v1`) | 0 | `main.ts` L7 | **0%** |
| Variables de entorno requeridas | Parcial en DATABASE_SETUP.md (solo DB) | 14 variables con Joi validation | **30%** |

**Cobertura de arquitectura global: ~12%**

### 2.2 Cobertura de Entidades

DATABASE_SETUP.md lista 13 entidades organizadas en 5 grupos. El codigo tiene 18 entidades registradas.

| Grupo | Documentadas en DATABASE_SETUP.md | En codigo | Cobertura |
|-------|-----------------------------------|-----------|-----------|
| Usuarios y Perfiles | User, Student, Tutor (3) | User, Student, Tutor (3) | **100%** |
| Materias | Subject, TutorImpartSubject, StudentInterestedSubject (3) | Igual (3) | **100%** |
| Disponibilidad | Availability, TutorHaveAvailability (2) | Igual (2) | **100%** |
| Sesiones | Session, ScheduledSession, StudentParticipateSession (3) | + SessionModificationRequest (4) | **75%** |
| Evaluacion | Question, Answer (2) | Igual (2) | **100%** |
| Auth | **NO DOCUMENTADAS** | AuthSession, AuditLog, PasswordResetToken, EmailVerificationToken (4) | **0%** |

**Entidades faltantes en DATABASE_SETUP.md**:
- `SessionModificationRequest` (`/src/modules/scheduling/entities/session-modification-request.entity.ts`)
- `AuthSession` (`/src/modules/auth/entities/session.entity.ts`)
- `AuditLog` (`/src/modules/auth/entities/audit-log.entity.ts`)
- `PasswordResetToken` (`/src/modules/auth/entities/password-reset-token.entity.ts`)
- `EmailVerificationToken` (`/src/modules/auth/entities/email-verification-token.entity.ts`)

**Cobertura de entidades: 13/18 = 72%** (solo conteo de nombres, sin detalle de campos)

**Cobertura de campos de entidades: 0%** -- DATABASE_SETUP.md no lista ningun campo, tipo de dato, constraint ni relacion para ninguna entidad.

### 2.3 Cobertura de Endpoints API

| Modulo | Endpoints en codigo | Endpoints documentados | Cobertura |
|--------|--------------------|-----------------------|-----------|
| Auth | 13 | 0 | **0%** |
| Tutor | 7 | 0 | **0%** |
| Subjects | 3 | 0 | **0%** |
| Availability | 4 | 0 | **0%** |
| Scheduling | 10 | 0 | **0%** |
| Users | 0 (controlador vacio) | 0 | N/A |
| Students | 0 (controlador vacio) | 0 | N/A |
| Notifications | 0 (controlador vacio) | 0 | N/A |
| Evaluation | 0 (controlador vacio) | 0 | N/A |
| TutorRatings | 0 (controlador vacio) | 0 | N/A |
| Attendance | 0 (controlador vacio) | 0 | N/A |
| **TOTAL** | **37 endpoints activos** | **0** | **0%** |

**Cobertura de API: 0%** -- No existe ninguna documentacion de API (ni OpenAPI, ni Swagger, ni manual).

### 2.4 Cobertura de Reglas de Negocio

| Regla | En codigo | Documentada | Referencia en codigo |
|-------|-----------|-------------|---------------------|
| Email debe ser `@udistrital.edu.co` | Si | No | `auth.service.ts`, `tutor.service.ts`, decorador `IsInstitutionalEmail` |
| Bloqueo de cuenta tras 5 intentos fallidos | Si | No | `auth.service.ts` L115-125 |
| Bloqueo dura 15 minutos | Si | No | `auth.service.ts` L108 |
| Contrasena temporal para tutores | Si | No | `tutor.service.ts` L52 |
| Maximo 3 materias por tutor | Si | No | `subjects.service.ts` |
| Slots de 30 minutos fijos | Si | No | `availability.service.ts` |
| Maximo 8 slots (4 horas) por dia | Si | No | `availability.service.ts` |
| Cancelacion con 24 horas de antelacion | Si | No | `session-validation.service.ts` |
| Token de acceso expira en 1 hora | Si | No | `auth.module.ts` |
| Token de refresco expira en 30 dias | Si | No | `auth.service.ts` |
| Rotacion de refresh token | Si | No | `auth.service.ts` |
| Reset de contrasena expira en 1 hora | Si | No | `password-reset.service.ts` |
| Verificacion de email expira en 24 horas | Si | No | `email-verification.service.ts` |
| Sesion requiere confirmacion del tutor | Si | No | `session.service.ts` |
| Estudiante no puede ser su propio tutor | Si | No | `session-validation.service.ts` |
| Limite semanal de horas por tutor (default 8) | Si | No | `tutor.entity.ts` |

**Cobertura de reglas de negocio: 0%** -- Ninguna regla de negocio esta documentada fuera del codigo fuente.

### 2.5 Cobertura de Enumeraciones

| Enum | Archivo | Valores | Documentada |
|------|---------|---------|-------------|
| UserRole | `user.entity.ts` L15-19 | STUDENT, TUTOR, ADMIN | No |
| UserStatus | `user.entity.ts` L21-25 | ACTIVE, PENDING, BLOCKED | No |
| PreferredModality | `student.entity.ts` | PRES, VIRT | No |
| DayOfWeek | `availability/enums/day-of-week.enum.ts` | MON-SAT (0-5) | No |
| Modality | `availability/enums/modality.enum.ts` | PRES, VIRT | No |
| SlotAction | `availability/enums/slot-action.enum.ts` | CREATE, UPDATE, DELETE | No |
| SessionStatus | `scheduling/enums/session-status.enum.ts` | 8 valores | No |
| SessionType | `scheduling/enums/session-type.enum.ts` | INDIVIDUAL, GROUP | No |
| ModificationStatus | `scheduling/enums/modification-status.enum.ts` | 4 valores | No |
| ParticipationStatus | `scheduling/enums/participation-status.enum.ts` | 4 valores | No |
| ErrorCode | `auth/enums/error-codes.enum.ts` | 12 valores | No |

**Cobertura de enums: 0%**

---

## 3. Cobertura Global

| Area | Cobertura |
|------|-----------|
| Arquitectura | ~12% |
| Entidades (nombres) | 72% |
| Entidades (campos/relaciones) | 0% |
| Endpoints API | 0% |
| Reglas de negocio | 0% |
| Enumeraciones | 0% |
| Variables de entorno | ~30% |
| Flujos de autenticacion | 0% |
| Ciclo de vida de sesiones | 0% |
| Sistema de notificaciones (19 templates) | 0% |

### Cobertura documental ponderada: ~8%

La unica documentacion util es `DATABASE_SETUP.md`, que cubre parcialmente la configuracion de base de datos y lista 13 de 18 entidades (solo nombres, sin detalle). El `README.md` es completamente inutilizable debido a un conflicto de merge sin resolver.

---

## 4. Gaps Criticos de Documentacion

### Prioridad ALTA (necesarios para onboarding de nuevos desarrolladores)

1. **README.md funcional** -- El actual tiene un merge conflict (`<<<<<<< HEAD` en linea 1). No se puede usar.
2. **Documentacion de API** -- 37 endpoints activos sin ninguna forma de documentacion. No hay OpenAPI/Swagger configurado.
3. **Variables de entorno** -- 14 variables requeridas validadas por Joi, pero solo 5 (las de DB) estan documentadas en DATABASE_SETUP.md. Faltan: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_URL`, `FRONTEND_URL`, etc.
4. **Documentacion de autenticacion** -- Flujo completo de JWT con access/refresh tokens, rotacion, bloqueo de cuenta, verificacion de email, reset de contrasena. Nada documentado.

### Prioridad MEDIA (necesarios para mantenimiento)

5. **Diagrama entidad-relacion** -- 18 entidades con relaciones complejas (OneToOne, OneToMany, ManyToOne, ManyToMany implicito via tablas intermedias). Solo existen los nombres en DATABASE_SETUP.md.
6. **Flujo de ciclo de vida de sesiones** -- 8 estados posibles con transiciones especificas. Logica distribuida en `session.service.ts` (~1300 lineas) y `session-validation.service.ts`.
7. **Documentacion de roles y permisos** -- 3 roles (STUDENT, TUTOR, ADMIN) con permisos distintos por endpoint. No hay matriz de permisos documentada.
8. **Entidades Auth faltantes en DATABASE_SETUP.md** -- 4 entidades de autenticacion y 1 de scheduling no estan listadas.

### Prioridad BAJA (nice to have)

9. **Documentacion de sistema de notificaciones** -- 19 templates de email con variables especificas. Ningun template documentado.
10. **Guia de contribucion y estrategia Git** -- El merge conflict del README contiene una mencion a "main/develop/feature" pero no es accesible.
11. **CHANGELOG** -- 100+ commits sin registro de cambios estructurado.
