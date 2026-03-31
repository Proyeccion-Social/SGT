# Catalogo Completo de Endpoints API - atlas-sgt

## Fecha de extraccion: 2026-03-31
## Prefijo global: `api/v1`

---

## Resumen

| Modulo | Controller | Base Path | Endpoints Activos | Endpoints Vacios |
|--------|------------|-----------|-------------------|------------------|
| Auth | AuthController | `/auth` | 12 | 0 |
| Users | UsersController | `/users` | 0 | (controller vacio) |
| Students | StudentsController | `/students` | 0 | (controller vacio) |
| Tutors | TutorsController | `/tutors` | 7 | 0 |
| Subjects | SubjectsController | `/subjects` | 3 | 0 |
| Availability | AvailabilityController | `/availability` | 4 | 0 |
| Scheduling | SessionController | `/scheduling/sessions` | 10 | 0 |
| Evaluation | EvaluationController | `/evaluation` | 0 | (controller vacio) |
| TutorRatings | TutorRatingsController | `/tutor-ratings` | 0 | (controller vacio) |
| Notifications | NotificationsController | `/notifications` | 0 | (controller vacio) |
| **TOTAL** | | | **36** | **4 controllers vacios** |

---

## 1. AuthController - `/api/v1/auth`

**Archivo**: `/src/modules/auth/controllers/auth.controller.ts`

### EP-01: POST /api/v1/auth/register
- **Linea**: 44
- **Descripcion**: Registrar estudiante nuevo
- **Guard**: `@Public()` (sin autenticacion)
- **DTO entrada**: `RegisterDto` { name, email, password, confirmPassword }
- **HTTP Code**: 201 CREATED
- **Respuesta**: `{ message: string }`
- **Reglas de negocio**:
  - Email debe ser `@udistrital.edu.co`
  - Password: min 8 chars, mayusculas, minusculas, numeros, especiales
  - Passwords deben coincidir
  - Crea usuario con rol STUDENT y status PENDING
  - Envia email de verificacion
  - Registra auditoria

### EP-02: POST /api/v1/auth/confirm-email
- **Linea**: 57
- **Descripcion**: Confirmar correo electronico con token
- **Guard**: `@Public()`
- **DTO entrada**: `ConfirmEmailDto` { token }
- **HTTP Code**: 200 OK
- **Respuesta**: `{ message: string }`
- **Reglas**: Valida token, marca como verificado, cambia status a ACTIVE, envia email de bienvenida

### EP-03: POST /api/v1/auth/check-email
- **Linea**: 68
- **Descripcion**: Verificar si un email ya existe en el sistema
- **Guard**: `@Public()`
- **DTO entrada**: `CheckEmailDto` { email } (debe ser `@udistrital.edu.co`)
- **HTTP Code**: 200 OK
- **Respuesta**: `{ exists: boolean }`

### EP-04: POST /api/v1/auth/login
- **Linea**: 80
- **Descripcion**: Iniciar sesion
- **Guard**: `@Public()`
- **DTO entrada**: `LoginDto` { email, password }
- **HTTP Code**: 200 OK
- **Respuesta**: `{ accessToken, refreshToken, user: { id, name, email, role, emailVerified }, requiresPasswordChange?, requiresProfileCompletion? }`
- **Reglas de negocio**:
  - Verifica bloqueo por intentos fallidos
  - Desbloqueo automatico si paso el tiempo
  - Maximo 5 intentos fallidos -> bloqueo 15 minutos
  - Status debe ser ACTIVE (PENDING lanza error "verify email")
  - Access token expira en 1h
  - Refresh token expira en 30d
  - Para TUTOR: indica si requiere cambio de contrasena o completar perfil

### EP-05: POST /api/v1/auth/refresh
- **Linea**: 94
- **Descripcion**: Refrescar access token
- **Guard**: `@Public()`
- **DTO entrada**: `RefreshTokenDto` { refreshToken }
- **HTTP Code**: 200 OK
- **Respuesta**: `{ accessToken, refreshToken }` (token rotation)

### EP-06: POST /api/v1/auth/logout
- **Linea**: 106
- **Descripcion**: Cerrar sesion
- **Guard**: `JwtAuthGuard` (requiere autenticacion)
- **DTO entrada**: `RefreshTokenDto` { refreshToken }
- **HTTP Code**: 200 OK
- **Respuesta**: `{ message: string }`

### EP-07: POST /api/v1/auth/password/recover
- **Linea**: 125
- **Descripcion**: Solicitar recuperacion de contrasena
- **Guard**: `@Public()`
- **DTO entrada**: `RecoverPasswordDto` { email }
- **HTTP Code**: 200 OK
- **Respuesta**: `{ message: string }` (siempre el mismo mensaje por seguridad)
- **Regla**: Token de reset expira en 1 hora

### EP-08: POST /api/v1/auth/password/reset
- **Linea**: 136
- **Descripcion**: Restablecer contrasena con token
- **Guard**: `@Public()`
- **Query param**: `token` (string)
- **DTO entrada**: `ResetPasswordDto` { password, confirmPassword }
- **HTTP Code**: 200 OK
- **Respuesta**: `{ message: string }`
- **Reglas**: Valida token, valida requisitos de contrasena, revoca todas las sesiones activas

### EP-09: POST /api/v1/auth/password/change
- **Linea**: 158
- **Descripcion**: Cambiar contrasena (usuario autenticado)
- **Guard**: `JwtAuthGuard`
- **DTO entrada**: `ChangePasswordDto` { currentPassword, newPassword, confirmNewPassword }
- **HTTP Code**: 200 OK
- **Respuesta**: `{ message: string }`
- **Reglas**: Valida contrasena actual, nueva debe ser diferente, revoca todas las sesiones

### EP-10: GET /api/v1/auth/sessions/current
- **Linea**: 174
- **Descripcion**: Consultar sesiones de autenticacion activas del usuario actual
- **Guard**: `JwtAuthGuard`
- **Respuesta**: `{ activeSessions: number, sessions: [{ id, userAgent, createdAt, expiresAt }] }`

### EP-11: GET /api/v1/auth/sessions/audit-logs
- **Linea**: 184
- **Descripcion**: Auditoria de accesos
- **Guard**: `JwtAuthGuard` + `RolesGuard`
- **Roles**: Solo `ADMIN`
- **Query params**: userId?, action?, result?, from?, to?, ipAddress?, page?, limit?
- **Respuesta**: `{ data: AuditLog[], meta: { total, page, limit, totalPages } }`

### EP-12: GET /api/v1/auth/me
- **Linea**: 226
- **Descripcion**: Obtener informacion del usuario actual (validar access token)
- **Guard**: `JwtAuthGuard`
- **Respuesta**: `{ user: { id, name, email, role, emailVerified, status }, requiresPasswordChange?, requiresProfileCompletion? }`

### EP-13: GET /api/v1/auth/sessions/audit-logs/export
- **Linea**: 236
- **Descripcion**: Exportar auditoria a CSV
- **Guard**: `JwtAuthGuard` + `RolesGuard`
- **Roles**: Solo `ADMIN`
- **Query params**: from?, to?, userId?
- **Respuesta**: `{ filename: string, content: string (CSV) }`

---

## 2. TutorsController - `/api/v1/tutors`

**Archivo**: `/src/modules/tutor/controllers/tutor.controller.ts`

### EP-14: POST /api/v1/tutors
- **Linea**: 34
- **Descripcion**: RF08 - Crear tutor (solo admin)
- **Guard**: `JwtAuthGuard` + `RolesGuard`
- **Roles**: Solo `ADMIN`
- **DTO entrada**: `CreateTutorDto` { name, email }
- **HTTP Code**: 201 CREATED
- **Respuesta**: `{ message, tutor: { id, name, email } }`
- **Reglas**:
  - Email debe ser `@udistrital.edu.co`
  - Genera contrasena temporal (formato: `Tutor{year}!{random}`)
  - Crea usuario con rol TUTOR, status ACTIVE, emailVerified true
  - `password_changed_at` = null (indica contrasena temporal)
  - Envia credenciales por email

### EP-15: POST /api/v1/tutors/profile/complete
- **Linea**: 49
- **Descripcion**: RF09 - Completar perfil de tutor
- **Guard**: `JwtAuthGuard` + `RolesGuard`
- **Roles**: Solo `TUTOR`
- **DTO entrada**: `CompleteTutorProfileDto` { phone, url_image, max_weekly_hours, subject_ids, availabilities? }
- **HTTP Code**: 200 OK
- **Respuesta**: `{ message: string }`
- **Reglas**:
  - Debe haber cambiado la contrasena temporal primero
  - phone: 10 digitos
  - max_weekly_hours: 1-40
  - subject_ids: array de UUID, minimo 1
  - Marca profile_completed = true, isActive = true

### EP-16: PATCH /api/v1/tutors/profile/update
- **Linea**: 64
- **Descripcion**: RF10 - Actualizar perfil de tutor
- **Guard**: `JwtAuthGuard` + `RolesGuard`
- **Roles**: Solo `TUTOR`
- **DTO entrada**: `CompleteTutorProfileDto` (misma que completar perfil)
- **HTTP Code**: 200 OK
- **Respuesta**: `{ message: string }`

### EP-17: GET /api/v1/tutors/me/status
- **Linea**: 80
- **Descripcion**: Estado del perfil del tutor autenticado
- **Guard**: `JwtAuthGuard` + `RolesGuard`
- **Roles**: Solo `TUTOR`
- **Respuesta**: `{ userId, name, email, hasTemporaryPassword, profileCompleted, requiresPasswordChange, requiresProfileCompletion }`

### EP-18: PATCH /api/v1/tutors/:id/active
- **Linea**: 104
- **Descripcion**: Activar/desactivar tutor
- **Guard**: `JwtAuthGuard` + `RolesGuard`
- **Roles**: Solo `ADMIN`
- **Body**: `{ isActive: boolean }`
- **HTTP Code**: 200 OK
- **Respuesta**: `{ message: string }`
- **Regla**: Si se desactiva, se eliminan todas las asignaciones de materias

### EP-19: GET /api/v1/tutors/profile
- **Linea**: 121
- **Descripcion**: RF12 - Ver perfil propio (tutor autenticado)
- **Guard**: `JwtAuthGuard` + `RolesGuard`
- **Roles**: Solo `TUTOR`
- **Respuesta**: `TutorPublicProfileDto`

### EP-20: GET /api/v1/tutors/:id
- **Linea**: 132
- **Descripcion**: RF11 - Perfil publico de tutor
- **Guard**: `@Public()` (sin autenticacion)
- **Respuesta**: `TutorPublicProfileDto` { id, name, photo, subjects, averageRating, totalRatings, completedSessions, availableModalities, maxWeeklyHours, currentWeekHoursUsed, availableHoursThisWeek }
- **Nota**: averageRating, totalRatings, completedSessions, currentWeekHoursUsed son placeholders (= 0)

---

## 3. SubjectsController - `/api/v1/subjects`

**Archivo**: `/src/modules/subjects/controllers/subjects.controller.ts`

### EP-21: GET /api/v1/subjects
- **Linea**: 16
- **Descripcion**: Listar todas las materias (paginado)
- **Guard**: `@Public()`
- **Query params**: SubjectFilterDto (extiende PaginationDto: page?, limit?)
- **Respuesta**: `{ success, data: [{ id, name }], meta: { total, page, limit, totalPages, hasNextPage, hasPreviousPage } }`

### EP-22: GET /api/v1/subjects/:id
- **Linea**: 29
- **Descripcion**: Obtener una materia especifica
- **Guard**: `@Public()`
- **Respuesta**: `{ success, data: { id, name } }`

### EP-23: GET /api/v1/subjects/:id/tutors
- **Linea**: 52
- **Descripcion**: RF-14 - Visualizar tutores por materia
- **Guard**: `@Public()`
- **Respuesta**: `{ success, subjectId, data: string[] (tutor IDs), total }`
- **Nota**: Retorna solo IDs de tutores, no informacion completa (hay un TODO pendiente)

---

## 4. AvailabilityController - `/api/v1/availability`

**Archivo**: `/src/modules/availability/controllers/availability.controller.ts`

### EP-24: GET /api/v1/availability/tutors/subject
- **Linea**: 46
- **Descripcion**: RF-14 - Visualizar tutores por materia con disponibilidad
- **Guard**: Sin guard explicito (publico por defecto)
- **Query params**: `FilterTutorsDto` { subjectId?, subjectName?, modality?, onlyAvailable?, page?, limit? }
- **Respuesta**: `{ success, subject: { id, name }, data: [...tutores con disponibilidad], meta: paginacion }`
- **Regla**: Debe proporcionar subjectId O subjectName

### EP-25: POST /api/v1/availability/tutor/slots
- **Linea**: 89
- **Descripcion**: RF-15 - Gestionar disponibilidad del tutor (CREATE/UPDATE/DELETE)
- **Guard**: `JwtAuthGuard` + `RolesGuard`
- **Roles**: Solo `TUTOR`
- **DTO entrada**: `ManageSlotDto` { action: 'CREATE'|'UPDATE'|'DELETE', data: CreateSlotDto|UpdateSlotDto|DeleteSlotDto }
  - **CREATE data**: { dayOfWeek (MONDAY..SATURDAY), startTime (HH:mm, incrementos de 30min), modality (PRES|VIRT) }
  - **UPDATE data**: { slotId (number), startTime? (HH:mm), modality? (PRES|VIRT) }
  - **DELETE data**: { slotId (number) }
- **Respuestas**:
  - CREATE: 201 `{ statusCode, message, slot: { slotId, tutorId, dayOfWeek, startTime, modality, duration: 0.5 } }`
  - UPDATE: 200 `{ statusCode, message, slot }`
  - DELETE: 200 `{ statusCode, message, slotId }`
- **Reglas**:
  - Slots de 30 minutos fijos
  - Maximo 8 slots por dia (4 horas) excepto si solo tiene 1 dia
  - No solapamiento en mismo dia/hora
  - No se puede actualizar dayOfWeek (eliminar y crear nuevo)

### EP-26: GET /api/v1/availability/tutors/:tutorId/slots
- **Linea**: 160
- **Descripcion**: RF16 - Ver disponibilidad de un tutor especifico
- **Guard**: Sin guard explicito (publico)
- **Param**: tutorId (UUID)
- **Query params**: `GetAvailabilityQueryDto` { onlyAvailable?, onlyFuture?, modality? }
- **Respuesta**: `TutorAvailabilityPublic` { tutorId, tutorName, totalSlots, availableSlots: [...], groupedByDay: { MONDAY: [...], ... } }

### EP-27: GET /api/v1/availability/tutors/slots
- **Linea**: 178
- **Descripcion**: Listar todos los tutores con disponibilidad
- **Guard**: Sin guard explicito (publico)
- **Query params**: `GetAvailabilityQueryDto` { modality?, onlyAvailable? }
- **Respuesta**: `[{ tutorId, tutorName, totalSlots, availableSlots, modalities }]`

---

## 5. SessionController - `/api/v1/scheduling/sessions`

**Archivo**: `/src/modules/scheduling/controllers/sessions.controller.ts`
**Guard global del controller**: `JwtAuthGuard` + `RolesGuard`

### EP-28: POST /api/v1/scheduling/sessions/individual
- **Linea**: 43
- **Descripcion**: RF-19, RF-20 - Crear sesion individual
- **Roles**: Solo `STUDENT`
- **DTO entrada**: `CreateIndividualSessionDto` { tutorId (UUID), subjectId (UUID), availabilityId (number), scheduledDate (YYYY-MM-DD), modality (PRES|VIRT), durationHours (1|1.5|2), title (5-100 chars), description (10-500 chars) }
- **HTTP Code**: 201 CREATED
- **Respuesta**: Detalle completo de la sesion creada
- **Reglas de negocio**:
  - Estudiante no puede ser el mismo tutor
  - Tutor debe existir y estar activo con perfil completo
  - Tutor debe impartir la materia
  - La franja debe existir y coincidir en modalidad
  - La fecha debe coincidir con el dia de la semana de la franja
  - No conflictos de horario con otras sesiones del tutor
  - No exceder limite semanal de horas del tutor
  - La franja debe estar disponible para esa fecha
  - Usa transaccion para crear Session + ScheduledSession + StudentParticipateSession atomicamente
  - Estado inicial: PENDING_TUTOR_CONFIRMATION

### EP-29: POST /api/v1/scheduling/sessions/:id/confirm
- **Linea**: 62
- **Descripcion**: RF-20 - Confirmar sesion pendiente
- **Roles**: Solo `TUTOR`
- **DTO entrada**: `ConfirmSessionDto` { message? (max 500 chars) }
- **HTTP Code**: 200 OK
- **Reglas**: Solo el tutor asignado, solo sesiones en estado PENDING_TUTOR_CONFIRMATION

### EP-30: POST /api/v1/scheduling/sessions/:id/reject
- **Linea**: 83
- **Descripcion**: RF-20 - Rechazar sesion pendiente
- **Roles**: Solo `TUTOR`
- **DTO entrada**: `RejectSessionDto` { reason (10-500 chars) }
- **HTTP Code**: 200 OK
- **Reglas**: Solo el tutor asignado, solo sesiones en estado PENDING_TUTOR_CONFIRMATION

### EP-31: DELETE /api/v1/scheduling/sessions/:id
- **Linea**: 101
- **Descripcion**: RF-21 - Cancelar sesion
- **Roles**: `STUDENT`, `TUTOR`, `ADMIN`
- **DTO entrada**: `CancelSessionDto` { reason (10-500 chars) }
- **HTTP Code**: 200 OK
- **Reglas**:
  - Solo participantes de la sesion o admin
  - Estudiante: solo puede cancelar sesiones donde participa
  - Tutor: solo puede cancelar sesiones que le pertenecen
  - Admin: puede cancelar cualquier sesion
  - Se registra si fue cancelada dentro de las 24h previas
  - Se notifica a ambas partes por email

### EP-32: POST /api/v1/scheduling/sessions/:id/propose-modification
- **Linea**: 122
- **Descripcion**: RF-22 - Proponer modificacion de sesion
- **Roles**: `STUDENT`, `TUTOR`
- **DTO entrada**: `ProposeModificationDto` { newScheduledDate?, newAvailabilityId?, newModality?, newDurationHours? (1|1.5|2) }
- **HTTP Code**: 200 OK
- **Reglas**:
  - Solo participantes de la sesion
  - Solo sesiones en estado SCHEDULED
  - Debe proponer al menos un cambio
  - Valida nueva fecha/franja/horario/limite semanal
  - Cambia estado a PENDING_MODIFICATION
  - Expira en 24 horas
  - Notifica a la otra parte

### EP-33: PATCH /api/v1/scheduling/sessions/:id/modifications/:requestId/accept
- **Linea**: 145
- **Descripcion**: RF-22 - Aceptar modificacion propuesta
- **Roles**: `STUDENT`, `TUTOR`
- **HTTP Code**: 200 OK
- **Reglas**: Solo la contraparte puede aceptar/rechazar, aplica los cambios a la sesion

### EP-34: PATCH /api/v1/scheduling/sessions/:id/modifications/:requestId/reject
- **Linea**: 164
- **Descripcion**: RF-22 - Rechazar modificacion propuesta
- **Roles**: `STUDENT`, `TUTOR`
- **HTTP Code**: 200 OK
- **Reglas**: Restaura estado a SCHEDULED

### EP-35: PATCH /api/v1/scheduling/sessions/:id/details
- **Linea**: 189
- **Descripcion**: RF-22 - Actualizar titulo, descripcion, location, virtualLink de la sesion
- **Roles**: Solo `TUTOR`
- **DTO entrada**: `UpdateSessionDetailsDto` { title? (5-100), description? (10-500), location?, virtualLink? }
- **HTTP Code**: 200 OK
- **Reglas**: Solo el tutor de la sesion, no requiere aprobacion del estudiante

### EP-36: GET /api/v1/scheduling/sessions/:id
- **Linea**: 212
- **Descripcion**: Obtener detalles de una sesion
- **Roles**: `STUDENT`, `TUTOR`, `ADMIN`
- **Respuesta**: Detalle completo de la sesion con tutor, materia, participantes, solicitudes de modificacion

### EP-37: GET /api/v1/scheduling/sessions/my-sessions/student
- **Linea**: 220
- **Descripcion**: Listar sesiones del estudiante autenticado
- **Roles**: Solo `STUDENT`
- **Query params**: `SessionFilterDto` { page?, limit?, status? (SCHEDULED|COMPLETED|CANCELLED) }
- **Respuesta**: Lista paginada de sesiones

### EP-38: GET /api/v1/scheduling/sessions/my-sessions/tutor
- **Linea**: 232
- **Descripcion**: Listar sesiones del tutor autenticado
- **Roles**: Solo `TUTOR`
- **Query params**: `SessionFilterDto` { page?, limit?, status? (SCHEDULED|COMPLETED|CANCELLED) }
- **Respuesta**: Lista paginada de sesiones

---

## 6. Controllers Vacios (Sin Endpoints)

### UsersController - `/api/v1/users`
- **Archivo**: `/src/modules/users/controllers/users.controller.ts` L1-4
- **Estado**: Controller declarado pero sin metodos

### StudentsController - `/api/v1/students`
- **Archivo**: `/src/modules/student/controllers/student.controller.ts` L1-4
- **Estado**: Controller declarado pero sin metodos

### EvaluationController - `/api/v1/evaluation`
- **Archivo**: `/src/modules/session-execution/controllers/evaluation.controller.ts` L1-4
- **Estado**: Controller declarado pero sin metodos. Comentarios indican endpoints planificados:
  - `POST /api/v1/session-execution/sessions/{sessionId}/evaluation`
  - `GET /api/v1/session-execution/sessions/{sessionId}/evaluation`

### TutorRatingsController - `/api/v1/tutor-ratings`
- **Archivo**: `/src/modules/session-execution/controllers/tutor-ratings.controller.ts` L1-4
- **Estado**: Controller declarado pero sin metodos. Comentarios indican endpoints planificados:
  - `GET /api/v1/session-execution/tutors/{tutorId}/evaluations`
  - `GET /api/v1/session-execution/tutors/{tutorId}/stats`

### NotificationsController - `/api/v1/notifications`
- **Archivo**: `/src/modules/notifications/controllers/notifications.controller.ts` L1-4
- **Estado**: Controller declarado pero sin metodos

---

## 7. Resumen de DTOs

### Auth DTOs
| DTO | Campos | Validaciones | Archivo |
|-----|--------|-------------|---------|
| `RegisterDto` | name, email, password, confirmPassword | name: min 3/max 255, email: @udistrital.edu.co, password: min 8 + regex | `/src/modules/auth/dto/register.dto.ts` |
| `RegisterStudentDto` | fullName, email, password, confirmPassword | Similar a RegisterDto + `@Match` decorator | `/src/modules/auth/dto/register-student.dto.ts` |
| `LoginDto` | email, password | email: valid, password: min 8 | `/src/modules/auth/dto/login.dto.ts` |
| `ChangePasswordDto` | currentPassword, newPassword, confirmNewPassword | min 8, regex para nueva | `/src/modules/auth/dto/change-password.dto.ts` |
| `RecoverPasswordDto` | email | email: valid | `/src/modules/auth/dto/recover-password.dto.ts` |
| `ResetPasswordDto` | password, confirmPassword | min 8, regex | `/src/modules/auth/dto/reset-password.dto.ts` |
| `RefreshTokenDto` | refreshToken | not empty | `/src/modules/auth/dto/refresh-token.dto.ts` |
| `ConfirmEmailDto` | token | not empty | `/src/modules/auth/dto/confirm-email.dto.ts` |
| `CheckEmailDto` | email | not empty, email, @udistrital.edu.co | `/src/modules/auth/dto/check-email.dto.ts` |

### Tutor DTOs
| DTO | Campos | Validaciones | Archivo |
|-----|--------|-------------|---------|
| `CreateTutorDto` | name, email | name: min 3, email: @udistrital.edu.co | `/src/modules/tutor/dto/create-tutor.dto.ts` |
| `CompleteTutorProfileDto` | phone, url_image, max_weekly_hours, subject_ids, availabilities? | phone: 10 digitos, url valid, hours: 1-40, subjects: min 1 UUID | `/src/modules/tutor/dto/complete-tutor-profile.dto.ts` |
| `TutorPublicProfileDto` | (response) id, name, photo, subjects, averageRating, totalRatings, completedSessions, availableModalities, maxWeeklyHours, currentWeekHoursUsed, availableHoursThisWeek | N/A (response type) | `/src/modules/tutor/dto/tutor-public-profile.dto.ts` |

### Subjects DTOs
| DTO | Campos | Validaciones | Archivo |
|-----|--------|-------------|---------|
| `AssignSubjectsDto` | subjects_ids | array, min 1, max 3, UUID each | `/src/modules/subjects/dto/assign-subjects.dto.ts` |
| `SubjectFilterDto` | (extends PaginationDto) page?, limit? | page: min 1, limit: min 1/max 50 | `/src/modules/subjects/dto/subject-filter.dto.ts` |

### Availability DTOs
| DTO | Campos | Validaciones | Archivo |
|-----|--------|-------------|---------|
| `ManageSlotDto` | action, data | action: CREATE/UPDATE/DELETE | `/src/modules/availability/dto/manage-slot.dto.ts` |
| `CreateSlotDto` | dayOfWeek, startTime, modality | day: enum, time: HH:mm + 30min increment, modality: PRES/VIRT | `/src/modules/availability/dto/create-slot.dto.ts` |
| `UpdateSlotDto` | slotId, startTime?, modality? | slotId: positive number | `/src/modules/availability/dto/update-slot.dto.ts` |
| `DeleteSlotDto` | slotId | slotId: positive number | `/src/modules/availability/dto/delete-slot.dto.ts` |
| `FilterTutorsDto` | (extends PaginationDto) subjectId?, subjectName?, modality?, onlyAvailable? | | `/src/modules/availability/dto/filter-tutors.dto.ts` |
| `GetAvailabilityQueryDto` | onlyAvailable?, onlyFuture?, modality? | booleans via Transform | `/src/modules/availability/dto/GetAvailabilityQueryDto.ts` |

### Scheduling DTOs
| DTO | Campos | Validaciones | Archivo |
|-----|--------|-------------|---------|
| `CreateIndividualSessionDto` | tutorId, subjectId, availabilityId, scheduledDate, modality, durationHours, title, description | UUID, number, date string, PRES/VIRT, 1/1.5/2, strings con min/max | `/src/modules/scheduling/dto/create-individual-session.dto.ts` |
| `CancelSessionDto` | reason | min 10, max 500 | `/src/modules/scheduling/dto/cancel-session.dto.ts` |
| `ConfirmSessionDto` | message? | max 500 | `/src/modules/scheduling/dto/confirm-session.dto.ts` |
| `RejectSessionDto` | reason | min 10, max 500 | `/src/modules/scheduling/dto/reject-session.dto.ts` |
| `ProposeModificationDto` | newScheduledDate?, newAvailabilityId?, newModality?, newDurationHours? | date string, number, PRES/VIRT, 1/1.5/2 | `/src/modules/scheduling/dto/propose-modification.dto.ts` |
| `UpdateSessionDetailsDto` | title?, description?, location?, virtualLink? | title: 5-100, desc: 10-500 | `/src/modules/scheduling/dto/update-session-details.dto.ts` |
| `SessionFilterDto` | (extends PaginationDto) status? | SCHEDULED/COMPLETED/CANCELLED | `/src/modules/scheduling/dto/session-filter.dto.ts` |

### Common DTOs
| DTO | Campos | Validaciones | Archivo |
|-----|--------|-------------|---------|
| `PaginationDto` | page?, limit? | page: min 1 (default 1), limit: min 1/max 50 (default 10) | `/src/modules/common/dto/pagination.dto.ts` |
