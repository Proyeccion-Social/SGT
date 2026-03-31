# Especificacion Tecnica - atlas-sgt

**Version**: 1.0.0
**Fecha**: 2026-03-31
**Confianza global**: 🔸 CODE_ONLY

---

## 1. Stack Tecnologico

| Componente | Tecnologia | Version |
|------------|-----------|---------|
| Runtime | Node.js | - |
| Framework | NestJS | ^11.0.1 |
| Lenguaje | TypeScript | ^5.7.3 |
| ORM | TypeORM | ^0.3.20 |
| Base de datos | PostgreSQL | - |
| Autenticacion | Passport + JWT | @nestjs/jwt, passport-jwt |
| Validacion | class-validator + class-transformer | (⚠️ ValidationPipe NO habilitado) |
| Hashing | bcryptjs | - |
| Email | Resend API | resend ^4.0.0 |
| Templates | Handlebars | @nestjs/platform-express + hbs |
| Config | @nestjs/config + Joi | - |
| Cron | @nestjs/schedule | - |
| Swagger | @nestjs/swagger | (importado pero no configurado) |

---

## 2. Arquitectura

### 2.1 Patron
Arquitectura Modular NestJS (variante de Layered Architecture):
```
Controller (HTTP) -> Service (Logica) -> Repository (TypeORM) -> PostgreSQL
```

### 2.2 Modulos

| Modulo | Base Path | Endpoints | Dependencias |
|--------|-----------|-----------|-------------|
| Auth | /auth | 13 | Users, Student, Tutor, Notifications |
| Users | /users | 0 (vacio) | - |
| Student | /students | 0 (vacio) | - |
| Tutor | /tutors | 7 | Subjects, Notifications, Users |
| Subjects | /subjects | 3 | - |
| Availability | /availability | 4 | Subjects, Tutor, Auth |
| Scheduling | /scheduling/sessions | 10 | Auth, Availability, Tutor, Users, Subjects, Notifications |
| Evaluation | /evaluation, /tutor-ratings | 0 (esqueleto) | - |
| Notifications | /notifications | 0 (solo servicio) | Config |

### 2.3 Prefijo Global
`api/v1` (definido en main.ts)

### 2.4 Puerto
`process.env.PORT ?? 3000`

---

## 3. Catalogo de API Endpoints

### 3.1 Auth (13 endpoints)

| # | Metodo | Ruta | Guard | Roles | DTO |
|---|--------|------|-------|-------|-----|
| EP-01 | POST | /auth/register | Public | - | RegisterDto |
| EP-02 | POST | /auth/confirm-email | Public | - | ConfirmEmailDto |
| EP-03 | POST | /auth/check-email | Public | - | CheckEmailDto |
| EP-04 | POST | /auth/login | Public | - | LoginDto |
| EP-05 | POST | /auth/refresh | Public | - | RefreshTokenDto |
| EP-06 | POST | /auth/logout | JWT | * | RefreshTokenDto |
| EP-07 | POST | /auth/password/recover | Public | - | RecoverPasswordDto |
| EP-08 | POST | /auth/password/reset | Public | - | ResetPasswordDto |
| EP-09 | POST | /auth/password/change | JWT | * | ChangePasswordDto |
| EP-10 | GET | /auth/sessions/current | JWT | * | - |
| EP-11 | GET | /auth/sessions/audit-logs | JWT+Roles | ADMIN | query params |
| EP-12 | GET | /auth/me | JWT | * | - |
| EP-13 | GET | /auth/sessions/audit-logs/export | JWT+Roles | ADMIN | query params |

### 3.2 Tutors (7 endpoints)

| # | Metodo | Ruta | Guard | Roles | DTO |
|---|--------|------|-------|-------|-----|
| EP-14 | POST | /tutors | JWT+Roles | ADMIN | CreateTutorDto |
| EP-15 | POST | /tutors/profile/complete | JWT+Roles | TUTOR | CompleteTutorProfileDto |
| EP-16 | PATCH | /tutors/profile/update | JWT+Roles | TUTOR | CompleteTutorProfileDto |
| EP-17 | GET | /tutors/me/status | JWT+Roles | TUTOR | - |
| EP-18 | PATCH | /tutors/:id/active | JWT+Roles | ADMIN | { isActive: boolean } |
| EP-19 | GET | /tutors/profile | JWT+Roles | TUTOR | - |
| EP-20 | GET | /tutors/:id | Public | - | - |

### 3.3 Subjects (3 endpoints)

| # | Metodo | Ruta | Guard | Roles | DTO |
|---|--------|------|-------|-------|-----|
| EP-21 | GET | /subjects | Public | - | SubjectFilterDto |
| EP-22 | GET | /subjects/:id | Public | - | - |
| EP-23 | GET | /subjects/:id/tutors | Public | - | - |

### 3.4 Availability (4 endpoints)

| # | Metodo | Ruta | Guard | Roles | DTO |
|---|--------|------|-------|-------|-----|
| EP-24 | GET | /availability/tutors/subject | - | - | FilterTutorsDto |
| EP-25 | POST | /availability/tutor/slots | JWT+Roles | TUTOR | ManageSlotDto |
| EP-26 | GET | /availability/tutors/:tutorId/slots | - | - | GetAvailabilityQueryDto |
| EP-27 | GET | /availability/tutors/slots | - | - | GetAvailabilityQueryDto |

### 3.5 Scheduling (11 endpoints)

| # | Metodo | Ruta | Guard | Roles | DTO |
|---|--------|------|-------|-------|-----|
| EP-28 | POST | /scheduling/sessions/individual | JWT+Roles | STUDENT | CreateIndividualSessionDto |
| EP-29 | POST | /scheduling/sessions/:id/confirm | JWT+Roles | TUTOR | ConfirmSessionDto |
| EP-30 | POST | /scheduling/sessions/:id/reject | JWT+Roles | TUTOR | RejectSessionDto |
| EP-31 | DELETE | /scheduling/sessions/:id | JWT+Roles | STUDENT,TUTOR,ADMIN | CancelSessionDto |
| EP-32 | POST | /scheduling/sessions/:id/propose-modification | JWT+Roles | STUDENT,TUTOR | ProposeModificationDto |
| EP-33 | PATCH | /scheduling/sessions/:id/modifications/:requestId/accept | JWT+Roles | STUDENT,TUTOR | - |
| EP-34 | PATCH | /scheduling/sessions/:id/modifications/:requestId/reject | JWT+Roles | STUDENT,TUTOR | - |
| EP-35 | PATCH | /scheduling/sessions/:id/details | JWT+Roles | TUTOR | UpdateSessionDetailsDto |
| EP-36 | GET | /scheduling/sessions/:id | JWT+Roles | STUDENT,TUTOR,ADMIN | - |
| EP-37 | GET | /scheduling/sessions/my-sessions/student | JWT+Roles | STUDENT | SessionFilterDto |
| EP-38 | GET | /scheduling/sessions/my-sessions/tutor | JWT+Roles | TUTOR | SessionFilterDto |

---

## 4. Modelo de Datos

### 4.1 Entidades (18 total)

| Entidad | Tabla | PK | Tipo |
|---------|-------|----|------|
| User | users | id_user | UUID |
| Student | students | id_user (FK) | UUID |
| Tutor | tutors | id_user (FK) | UUID |
| Subject | subject | id_subject | UUID |
| TutorImpartSubject | tutor_impart_subject | (id_tutor, id_subject) | Composite |
| StudentInterestedSubject | student_interested_subject | (id_student, id_subject) | Composite |
| Availability | availability | id_availability | BIGINT auto |
| TutorHaveAvailability | tutor_have_availability | (id_tutor, id_availability) | Composite |
| Session | sessions | id_session | UUID |
| ScheduledSession | scheduled_sessions | id_session (FK) | UUID |
| StudentParticipateSession | student_participate_session | (id_student, id_session) | Composite |
| SessionModificationRequest | session_modification_requests | id_request | UUID |
| Question | questions | id_question | UUID |
| Answer | answers | (id_question, id_student, id_session) | Composite |
| AuthSession | auth_sessions | id_session | UUID |
| AuditLog | audit_logs | id_log | UUID |
| PasswordResetToken | password_reset_tokens | id_token | UUID |
| EmailVerificationToken | email_verification_tokens | id_token | UUID |

### 4.2 Enums

| Enum | Valores | Ubicacion |
|------|---------|-----------|
| UserRole | STUDENT, TUTOR, ADMIN | user.entity.ts |
| UserStatus | ACTIVE, PENDING, BLOCKED | user.entity.ts |
| PreferredModality | PRES, VIRT | student.entity.ts |
| DayOfWeek | MONDAY-SATURDAY | availability/enums |
| Modality | PRES, VIRT | availability/enums |
| SlotAction | CREATE, UPDATE, DELETE | availability/enums |
| SessionType | INDIVIDUAL, GROUP | scheduling/enums |
| SessionStatus | PENDING_TUTOR_CONFIRMATION, SCHEDULED, PENDING_MODIFICATION, REJECTED_BY_TUTOR, CANCELLED_BY_STUDENT, CANCELLED_BY_TUTOR, CANCELLED_BY_ADMIN, COMPLETED | scheduling/enums |
| ParticipationStatus | CONFIRMED, ATTENDED, ABSENT, LATE | scheduling/enums |
| ModificationStatus | PENDING, ACCEPTED, REJECTED, EXPIRED | scheduling/enums |
| AuditAction | LOGIN, LOGIN_FAILED, LOGOUT, PASSWORD_CHANGE, PASSWORD_RESET_REQUESTED, PASSWORD_RESET_COMPLETED, ACCOUNT_CREATED, EMAIL_VERIFIED, ACCOUNT_LOCKED, ACCOUNT_UNLOCKED, SESSION_CREATED, SESSION_REFRESHED, SESSION_REVOKED, SESSION_EXPIRED | auth/entities |
| AuditResult | SUCCESS, FAILED | auth/entities |
| ErrorCode | VALIDATION_01/02, RESOURCE_01/02/03, AUTH_01-06, INTERNAL_01, PERMISSION_01 | auth/enums |

---

## 5. Seguridad

### 5.1 Autenticacion
- **Estrategia**: JWT Bearer Token (Passport)
- **Access Token**: 1h (hardcoded en auth.service.ts)
- **Refresh Token**: 30d con rotation
- **Hash**: bcrypt con 10 rounds

### 5.2 Autorizacion
- **JwtAuthGuard**: Valida token JWT valido
- **RolesGuard**: Verifica rol del usuario (@Roles decorator)
- **@Public()**: Marca endpoints sin autenticacion

### 5.3 Protecciones
- Bloqueo de cuenta: 5 intentos -> 15 min
- Token rotation en refresh
- Revocacion de todas las sesiones en cambio/reset de contrasena
- Hash de refresh tokens en BD (no almacena tokens en texto plano)

### 5.4 ⚠️ Problema Critico: ValidationPipe
`ValidationPipe` NO esta habilitado en `main.ts`. Todos los decoradores de `class-validator` en DTOs son **decorativos** y no se ejecutan en runtime. Cualquier payload malformado sera aceptado.

---

## 6. Integraciones Externas

| Servicio | Proposito | Configuracion |
|----------|-----------|--------------|
| Resend API | Envio de emails | RESEND_API_KEY (env) |
| PostgreSQL | Base de datos principal | DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME (env) |

---

## 7. Configuracion de Entorno

### 7.1 Variables Requeridas (validadas con Joi)

| Variable | Default | Descripcion |
|----------|---------|-------------|
| DB_HOST | - | Host PostgreSQL |
| DB_PORT | 5432 | Puerto PostgreSQL |
| DB_USERNAME | - | Usuario BD |
| DB_PASSWORD | - | Password BD |
| DB_NAME | - | Nombre BD |
| JWT_SECRET | - | Secret para JWT |
| JWT_ACCESS_TOKEN_TIME | 15m | Expiracion access token |
| JWT_REFRESH_TOKEN_TIME | 7d | Expiracion refresh token |
| RESEND_API_KEY | - | API key de Resend |
| FRONTEND_URL | http://localhost:3000 | URL del frontend |
| PORT | 3000 | Puerto de la app |

**Nota**: Hay discrepancia entre los defaults de env.config.ts (15m/7d) y los valores hardcodeados en auth.service.ts (1h/30d). Los hardcodeados son los que se ejecutan.

---

## 8. Code Ownership Map

| Componente | Rol | Archivos Primarios | Archivos de Soporte |
|------------|-----|-------------------|---------------------|
| Auth | Autenticacion/Autorizacion | auth.service.ts, auth.controller.ts | session.service.ts, email-verification.service.ts, password-reset.service.ts, audit-log.service.ts |
| Users | CRUD Usuarios | users.service.ts | user.entity.ts |
| Student | Perfil Estudiante | student.service.ts | student.entity.ts |
| Tutor | Gestion Tutores | tutor.service.ts, tutor.controller.ts | complete-tutor-profile.dto.ts |
| Subjects | Materias | subjects.service.ts, subjects.controller.ts | subjects.entity.ts |
| Availability | Disponibilidad | availability.service.ts, availability.controller.ts | availability.entity.ts, tutor-availability.entity.ts |
| Scheduling | Sesiones | session.service.ts, sessions.controller.ts, session-validation.service.ts | session.entity.ts, scheduled-session.entity.ts |
| Notifications | Emails | notifications.service.ts | templates/*.hbs |
| Common | Compartido | pagination.dto.ts, pagination.helper.ts | - |

---

## 9. Valores Hardcodeados (Candidatos a Externalizacion)

| Valor | Ubicacion | Proposito |
|-------|-----------|-----------|
| 24h | session-validation.service.ts:205 | Anticipacion minima para cancelar |
| 24h | notifications.service.ts:363 | Tiempo para confirmar tutoria |
| 24h | session.service.ts:678 | Expiracion solicitud de modificacion |
| [1, 1.5, 2] | create-individual-session.dto.ts:31 | Duraciones permitidas |
| 30 min | availability.service.ts:35 | Duracion de slot |
| 8 | availability.service.ts:36 | Max slots por dia |
| 1-40 | complete-tutor-profile.dto.ts:26-27 | Rango horas semanales |
| 8h | tutor.service.ts:489 | Default horas semanales |
| 80/95/100 | notifications.service.ts:964-971 | Umbrales de alerta |
| 5 intentos | auth.service.ts:210 | Max login fallidos |
| 15 min | auth.service.ts:212 | Duracion bloqueo cuenta |
| 10 | bcrypt calls | Rounds de hash |
| 24h/2h | notifications.service.ts:711-721 | Tiempos de recordatorio |
