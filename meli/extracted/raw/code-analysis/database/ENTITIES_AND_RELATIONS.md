# Catalogo Completo de Entidades y Relaciones - atlas-sgt

## Fecha de extraccion: 2026-03-31

---

## Resumen de Entidades

| # | Entidad | Tabla | PK | Tipo PK | Archivo |
|---|---------|-------|----|---------|---------|
| 1 | User | `users` | id_user | UUID auto | `/src/modules/users/entities/user.entity.ts` |
| 2 | Student | `students` | id_user | UUID (FK a users) | `/src/modules/student/entities/student.entity.ts` |
| 3 | Tutor | `tutors` | id_user | UUID (FK a users) | `/src/modules/tutor/entities/tutor.entity.ts` |
| 4 | Subject | `subject` | id_subject | UUID auto | `/src/modules/subjects/entities/subjects.entity.ts` |
| 5 | TutorImpartSubject | `tutor_impart_subject` | (id_tutor, id_subject) | Composite PK | `/src/modules/subjects/entities/tutor-subject.entity.ts` |
| 6 | StudentInterestedSubject | `student_interested_subject` | (id_student, id_subject) | Composite PK | `/src/modules/subjects/entities/student-subject.entity.ts` |
| 7 | Availability | `availability` | id_availability | BIGINT auto-increment | `/src/modules/availability/entities/availability.entity.ts` |
| 8 | TutorHaveAvailability | `tutor_have_availability` | (id_tutor, id_availability) | Composite PK | `/src/modules/availability/entities/tutor-availability.entity.ts` |
| 9 | Session | `sessions` | id_session | UUID auto | `/src/modules/scheduling/entities/session.entity.ts` |
| 10 | ScheduledSession | `scheduled_sessions` | id_session | UUID (FK a sessions) | `/src/modules/scheduling/entities/scheduled-session.entity.ts` |
| 11 | StudentParticipateSession | `student_participate_session` | (id_student, id_session) | Composite PK | `/src/modules/scheduling/entities/student-participate-session.entity.ts` |
| 12 | SessionModificationRequest | `session_modification_requests` | id_request | UUID auto | `/src/modules/scheduling/entities/session-modification-request.entity.ts` |
| 13 | Question | `questions` | id_question | UUID auto | `/src/modules/session-execution/entities/question.entity.ts` |
| 14 | Answer | `answers` | (id_question, id_student, id_session) | Composite PK | `/src/modules/session-execution/entities/answer.entity.ts` |
| 15 | AuthSession | `auth_sessions` | id_session | UUID auto | `/src/modules/auth/entities/session.entity.ts` |
| 16 | AuditLog | `audit_logs` | id_log | UUID auto | `/src/modules/auth/entities/audit-log.entity.ts` |
| 17 | PasswordResetToken | `password_reset_tokens` | id_token | UUID auto | `/src/modules/auth/entities/password-reset-token.entity.ts` |
| 18 | EmailVerificationToken | `email_verification_tokens` | id_token | UUID auto | `/src/modules/auth/entities/email-verification-token.entity.ts` |

---

## Detalle Completo por Entidad

### 1. User (`users`)
**Archivo**: `/src/modules/users/entities/user.entity.ts`

| Campo | Columna | Tipo DB | Nullable | Default | Constraint |
|-------|---------|---------|----------|---------|------------|
| idUser | id_user | uuid | NO | auto-generated | PK |
| name | name | varchar(100) | NO | - | - |
| email | email | varchar(150) | NO | - | UNIQUE |
| password | password | varchar(255) | NO | - | - |
| role | role | enum(UserRole) | NO | - | - |
| status | status | enum(UserStatus) | NO | - | - |
| emailVerified | email_verified | boolean | NO | false | - |
| createdAt | created_at | timestamp | NO | CURRENT_TIMESTAMP | - |
| updatedAt | updated_at | timestamp | NO | CURRENT_TIMESTAMP | - |
| email_verified_at | email_verified_at | timestamp | SI | null | - |
| failed_login_attempts | failed_login_attempts | integer | NO | 0 | - |
| locked_until | locked_until | timestamp | SI | null | - |
| password_changed_at | password_changed_at | timestamp | SI | null | - |

**Relaciones**:
- OneToOne -> Student (via student.id_user)
- OneToOne -> Tutor (via tutor.id_user)

### 2. Student (`students`)
**Archivo**: `/src/modules/student/entities/student.entity.ts`

| Campo | Columna | Tipo DB | Nullable | Default | Constraint |
|-------|---------|---------|----------|---------|------------|
| idUser | id_user | uuid | NO | - | PK, FK -> users.id_user |
| career | career | varchar(100) | SI | null | - |
| preferredModality | preferred_modality | enum(PreferredModality) | SI | null | - |

**Relaciones**:
- OneToOne -> User (via id_user)
- OneToMany -> StudentInterestedSubject
- OneToMany -> StudentParticipateSession

### 3. Tutor (`tutors`)
**Archivo**: `/src/modules/tutor/entities/tutor.entity.ts`

| Campo | Columna | Tipo DB | Nullable | Default | Constraint |
|-------|---------|---------|----------|---------|------------|
| idUser | id_user | uuid | NO | - | PK, FK -> users.id_user |
| phone | phone | varchar(20) | SI | null | - |
| isActive | is_active | boolean | NO | false | - |
| limitDisponibility | limit_disponibility | smallint | SI | 8 | - |
| profile_completed | profile_completed | boolean | NO | false | - |
| urlImage | url_image | text | SI | null | - |

**Relaciones**:
- OneToOne -> User (via id_user)
- OneToMany -> TutorImpartSubject
- OneToMany -> TutorHaveAvailability
- OneToMany -> Session (tutoring sessions)

### 4. Subject (`subject`)
**Archivo**: `/src/modules/subjects/entities/subjects.entity.ts`

| Campo | Columna | Tipo DB | Nullable | Default | Constraint |
|-------|---------|---------|----------|---------|------------|
| idSubject | id_subject | uuid | NO | auto-generated | PK |
| name | name | varchar(100) | NO | - | UNIQUE |
| isActive | is_active | boolean | NO | true | - |

**Relaciones**:
- OneToMany -> TutorImpartSubject
- OneToMany -> StudentInterestedSubject
- OneToMany -> Session

### 5. TutorImpartSubject (`tutor_impart_subject`)
**Archivo**: `/src/modules/subjects/entities/tutor-subject.entity.ts`

| Campo | Columna | Tipo DB | Nullable | Default | Constraint |
|-------|---------|---------|----------|---------|------------|
| idTutor | id_tutor | uuid | NO | - | PK (composite), FK -> tutors.id_user |
| idSubject | id_subject | uuid | NO | - | PK (composite), FK -> subject.id_subject |

**Relaciones**:
- ManyToOne -> Tutor
- ManyToOne -> Subject

### 6. StudentInterestedSubject (`student_interested_subject`)
**Archivo**: `/src/modules/subjects/entities/student-subject.entity.ts`

| Campo | Columna | Tipo DB | Nullable | Default | Constraint |
|-------|---------|---------|----------|---------|------------|
| idStudent | id_student | uuid | NO | - | PK (composite), FK -> students.id_user |
| idSubject | id_subject | uuid | NO | - | PK (composite), FK -> subject.id_subject |

**Relaciones**:
- ManyToOne -> Student
- ManyToOne -> Subject

### 7. Availability (`availability`)
**Archivo**: `/src/modules/availability/entities/availability.entity.ts`

| Campo | Columna | Tipo DB | Nullable | Default | Constraint |
|-------|---------|---------|----------|---------|------------|
| idAvailability | id_availability | bigint | NO | auto-increment | PK |
| dayOfWeek | day_of_week | smallint | NO | - | - |
| startTime | start_time | time | NO | - | - |

**Notas**: Representa una franja de 30 minutos. El campo dayOfWeek usa numeros: 0=Lunes, 1=Martes, ..., 5=Sabado. No incluye Domingo. endTime se calcula como startTime + 30min.

**Relaciones**:
- OneToMany -> TutorHaveAvailability
- OneToMany -> ScheduledSession

### 8. TutorHaveAvailability (`tutor_have_availability`)
**Archivo**: `/src/modules/availability/entities/tutor-availability.entity.ts`

| Campo | Columna | Tipo DB | Nullable | Default | Constraint |
|-------|---------|---------|----------|---------|------------|
| idTutor | id_tutor | uuid | NO | - | PK (composite), FK -> tutors.id_user |
| idAvailability | id_availability | bigint | NO | - | PK (composite), FK -> availability.id_availability |
| modality | modality | varchar(10) | SI | null | - |

**Relaciones**:
- ManyToOne -> Tutor
- ManyToOne -> Availability

### 9. Session (`sessions`)
**Archivo**: `/src/modules/scheduling/entities/session.entity.ts`

| Campo | Columna | Tipo DB | Nullable | Default | Constraint |
|-------|---------|---------|----------|---------|------------|
| idSession | id_session | uuid | NO | auto-generated | PK |
| idTutor | id_tutor | uuid | NO | - | FK -> tutors.id_user |
| idSubject | id_subject | uuid | NO | - | FK -> subject.id_subject |
| scheduledDate | scheduled_date | date | NO | - | - |
| startTime | start_time | time | NO | - | - |
| endTime | end_time | time | NO | - | - |
| title | title | varchar(100) | NO | - | - |
| description | description | text | NO | - | - |
| type | type | enum(SessionType) | NO | - | - |
| modality | modality | enum(Modality) | NO | - | - |
| location | location | varchar | SI | null | - |
| virtualLink | virtual_link | varchar | SI | null | - |
| status | status | enum(SessionStatus) | NO | SCHEDULED | - |
| cancellationReason | cancellation_reason | text | SI | null | - |
| cancelledAt | cancelled_at | timestamp | SI | null | - |
| cancelledWithin24h | cancelled_within_24h | boolean | NO | false | - |
| cancelledBy | cancelled_by | uuid | SI | null | - |
| createdAt | created_at | timestamp | NO | CURRENT_TIMESTAMP | - |
| tutorConfirmed | tutor_confirmed | boolean | NO | false | - |
| tutorConfirmedAt | tutor_confirmed_at | timestamp | SI | null | - |
| rejectionReason | rejection_reason | text | SI | null | - |
| rejectedAt | rejected_at | timestamp | SI | null | - |

**Relaciones**:
- ManyToOne -> Tutor
- ManyToOne -> Subject
- OneToMany -> StudentParticipateSession
- OneToOne -> ScheduledSession
- OneToMany -> SessionModificationRequest

### 10. ScheduledSession (`scheduled_sessions`)
**Archivo**: `/src/modules/scheduling/entities/scheduled-session.entity.ts`

| Campo | Columna | Tipo DB | Nullable | Default | Constraint |
|-------|---------|---------|----------|---------|------------|
| idSession | id_session | uuid | NO | - | PK, FK -> sessions.id_session |
| idTutor | id_tutor | uuid | NO | - | FK -> tutors.id_user |
| idAvailability | id_availability | bigint | NO | - | FK -> availability.id_availability |
| scheduledDate | scheduled_date | date | NO | - | - |

**Constraints**:
- UNIQUE: (id_tutor, id_availability, scheduled_date) - `UQ_tutor_availability_date`

**Relaciones**:
- ManyToOne -> Tutor
- ManyToOne -> Availability
- OneToOne -> Session

### 11. StudentParticipateSession (`student_participate_session`)
**Archivo**: `/src/modules/scheduling/entities/student-participate-session.entity.ts`

| Campo | Columna | Tipo DB | Nullable | Default | Constraint |
|-------|---------|---------|----------|---------|------------|
| idStudent | id_student | uuid | NO | - | PK (composite), FK -> students.id_user |
| idSession | id_session | uuid | NO | - | PK (composite), FK -> sessions.id_session |
| status | status | enum(ParticipationStatus) | SI | null | - |
| comment | comment | text | SI | null | - |

**Relaciones**:
- ManyToOne -> Student
- ManyToOne -> Session
- OneToMany -> Answer

### 12. SessionModificationRequest (`session_modification_requests`)
**Archivo**: `/src/modules/scheduling/entities/session-modification-request.entity.ts`

| Campo | Columna | Tipo DB | Nullable | Default | Constraint |
|-------|---------|---------|----------|---------|------------|
| idRequest | id_request | uuid | NO | auto-generated | PK |
| idSession | id_session | uuid | NO | - | FK -> sessions.id_session |
| requestedBy | requested_by | uuid | NO | - | FK -> users.id_user |
| newScheduledDate | new_scheduled_date | date | SI | null | - |
| newStartTime | new_start_time | time | SI | null | - |
| newAvailabilityId | new_availability_id | bigint | SI | null | - |
| newModality | new_modality | enum(Modality) | SI | null | - |
| newDurationHours | new_duration_hours | decimal(3,1) | SI | null | - |
| status | status | enum(ModificationStatus) | NO | PENDING | - |
| requestedAt | requested_at | timestamp | NO | CURRENT_TIMESTAMP | - |
| respondedAt | responded_at | timestamp | SI | null | - |
| respondedBy | responded_by | uuid | SI | null | - |
| expiresAt | expires_at | timestamp | NO | - | - |

**Relaciones**:
- ManyToOne -> Session
- ManyToOne -> User (requester)
- ManyToOne -> User (responder)

### 13. Question (`questions`)
**Archivo**: `/src/modules/session-execution/entities/question.entity.ts`

| Campo | Columna | Tipo DB | Nullable | Default | Constraint |
|-------|---------|---------|----------|---------|------------|
| idQuestion | id_question | uuid | NO | auto-generated | PK |
| content | content | text | NO | - | - |

**Relaciones**:
- OneToMany -> Answer

### 14. Answer (`answers`)
**Archivo**: `/src/modules/session-execution/entities/answer.entity.ts`

| Campo | Columna | Tipo DB | Nullable | Default | Constraint |
|-------|---------|---------|----------|---------|------------|
| idQuestion | id_question | uuid | NO | - | PK (composite), FK -> questions.id_question |
| idStudent | id_student | uuid | NO | - | PK (composite) |
| idSession | id_session | uuid | NO | - | PK (composite) |
| score | score | smallint | SI | null | - |

**Relaciones**:
- ManyToOne -> Question
- ManyToOne -> StudentParticipateSession (composite FK: id_student + id_session)

### 15. AuthSession (`auth_sessions`)
**Archivo**: `/src/modules/auth/entities/session.entity.ts`

| Campo | Columna | Tipo DB | Nullable | Default | Constraint |
|-------|---------|---------|----------|---------|------------|
| id_session | id_session | uuid | NO | auto-generated | PK |
| refresh_token_hash | refresh_token_hash | varchar(255) | NO | - | - |
| user_agent | user_agent | text | SI | null | - |
| expires_at | expires_at | timestamp | NO | - | - |
| created_at | created_at | timestamp | NO | CURRENT_TIMESTAMP | - |
| revoked_at | revoked_at | timestamp | SI | null | - |
| last_activity_at | last_activity_at | timestamp | NO | CURRENT_TIMESTAMP | - |

**Relaciones**:
- ManyToOne -> User (CASCADE on delete)

**Nota**: Existe una propiedad `startTime: any` huerfana en la clase (linea 44).

### 16. AuditLog (`audit_logs`)
**Archivo**: `/src/modules/auth/entities/audit-log.entity.ts`

| Campo | Columna | Tipo DB | Nullable | Default | Constraint |
|-------|---------|---------|----------|---------|------------|
| id_log | id_log | uuid | NO | auto-generated | PK |
| id_user | id_user | uuid | SI | null | FK -> users.id_user |
| id_session | id_session | uuid | SI | null | FK -> auth_sessions.id_session |
| action | action | enum(AuditAction) | NO | - | - |
| result | result | enum(AuditResult) | NO | - | - |
| email_attempted | email_attempted | varchar(255) | SI | null | - |
| failure_reason | failure_reason | text | SI | null | - |
| ip_address | ip_address | varchar(45) | SI | null | - |
| user_agent | user_agent | text | SI | null | - |
| metadata | metadata | jsonb | SI | null | - |
| created_at | created_at | timestamp | NO | CURRENT_TIMESTAMP | - |

**Relaciones**:
- ManyToOne -> User (SET NULL on delete)
- ManyToOne -> AuthSession (SET NULL on delete)

### 17. PasswordResetToken (`password_reset_tokens`)
**Archivo**: `/src/modules/auth/entities/password-reset-token.entity.ts`

| Campo | Columna | Tipo DB | Nullable | Default | Constraint |
|-------|---------|---------|----------|---------|------------|
| id_token | id_token | uuid | NO | auto-generated | PK |
| id_user | id_user | uuid | NO | - | FK -> users.id_user |
| token_hash | token_hash | varchar(255) | NO | - | - |
| expires_at | expires_at | timestamp | NO | - | - |
| created_at | created_at | timestamp | NO | CURRENT_TIMESTAMP | - |
| used_at | used_at | timestamp | SI | null | - |

**Relaciones**:
- ManyToOne -> User (CASCADE on delete)

### 18. EmailVerificationToken (`email_verification_tokens`)
**Archivo**: `/src/modules/auth/entities/email-verification-token.entity.ts`

| Campo | Columna | Tipo DB | Nullable | Default | Constraint |
|-------|---------|---------|----------|---------|------------|
| id_token | id_token | uuid | NO | auto-generated | PK |
| id_user | id_user | uuid | NO | - | FK -> users.id_user |
| token_hash | token_hash | varchar(255) | NO | - | - |
| expires_at | expires_at | timestamp | NO | - | - |
| created_at | created_at | timestamp | NO | CURRENT_TIMESTAMP | - |
| verified_at | verified_at | timestamp | SI | null | - |

**Relaciones**:
- ManyToOne -> User (CASCADE on delete)

---

## Catalogo Completo de Enums

### UserRole (definido en user.entity.ts L15-19)
```typescript
export enum UserRole {
  STUDENT = 'STUDENT',
  TUTOR = 'TUTOR',
  ADMIN = 'ADMIN',
}
```

### UserStatus (definido en user.entity.ts L21-25)
```typescript
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  BLOCKED = 'BLOCKED',
}
```
**NOTA**: Existe una DISCREPANCIA. En `/src/modules/auth/enums/user-status.enum.ts` se define un enum diferente con valores `Pending`, `Active`, `Inactive`, `Suspended` (con casing diferente y valores distintos). El que se usa realmente en las entidades es el definido en `user.entity.ts`.

### UserRole (duplicado en auth/enums/user-roles.enum.ts)
```typescript
export enum UserRole {
  STUDENT = "Student",
  TUTOR = "Tutor",
  ADMIN = "Admin",
}
```
**NOTA**: DISCREPANCIA - Este enum tiene valores en PascalCase (`Student`, `Tutor`, `Admin`) mientras el de `user.entity.ts` usa UPPER_CASE (`STUDENT`, `TUTOR`, `ADMIN`). El que se usa realmente es el de `user.entity.ts`.

### PreferredModality (student.entity.ts L13-16)
```typescript
export enum PreferredModality {
  PRES = 'PRES',
  VIRT = 'VIRT',
}
```

### DayOfWeek (availability/enums/day-of-week.enum.ts)
```typescript
export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
}
```
**Mapeo a numeros**: MONDAY=0, TUESDAY=1, WEDNESDAY=2, THURSDAY=3, FRIDAY=4, SATURDAY=5

### Modality (availability/enums/modality.enum.ts)
```typescript
export enum Modality {
  PRES = 'PRES',
  VIRT = 'VIRT',
}
```

### SlotAction (availability/enums/slot-action.enum.ts)
```typescript
export enum SlotAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}
```

### SessionType (scheduling/enums/session-type.enum.ts)
```typescript
export enum SessionType {
  INDIVIDUAL = 'INDIVIDUAL',
  GROUP = 'GROUP',
}
```

### SessionStatus (scheduling/enums/session-status.enum.ts)
```typescript
export enum SessionStatus {
  PENDING_TUTOR_CONFIRMATION = 'PENDING_TUTOR_CONFIRMATION',
  SCHEDULED = 'SCHEDULED',
  PENDING_MODIFICATION = 'PENDING_MODIFICATION',
  REJECTED_BY_TUTOR = 'REJECTED_BY_TUTOR',
  CANCELLED_BY_STUDENT = 'CANCELLED_BY_STUDENT',
  CANCELLED_BY_TUTOR = 'CANCELLED_BY_TUTOR',
  CANCELLED_BY_ADMIN = 'CANCELLED_BY_ADMIN',
  COMPLETED = 'COMPLETED',
}
```

### ParticipationStatus (scheduling/enums/participation-status.enum.ts)
```typescript
export enum ParticipationStatus {
  CONFIRMED = 'CONFIRMED',
  ATTENDED = 'ATTENDED',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
}
```
**NOTA**: Existe un enum comentado en `student-participate-session.entity.ts` con valores diferentes (REGISTERED, ATTENDED, ABSENT, CANCELLED). El que se usa es el del archivo enum separado.

### ModificationStatus (scheduling/enums/modification-status.enum.ts)
```typescript
export enum ModificationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}
```

### SessionModality (scheduling/enums/session-modality.enum.ts)
**COMPLETAMENTE COMENTADO** - No se usa. Se reemplaza por `Modality` de availability.
```typescript
// export enum SessionModality {
//   PRES = 'PRES',
//   VIRT = 'VIRT',
// }
```

### AuditAction (auth/entities/audit-log.entity.ts L13-28)
```typescript
export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_REFRESHED = 'SESSION_REFRESHED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
}
```

### AuditResult (auth/entities/audit-log.entity.ts L30-33)
```typescript
export enum AuditResult {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}
```

### ErrorCode (auth/enums/error-codes.enum.ts)
```typescript
export enum ErrorCode {
  VALIDATION_01 = "VALIDATION_01",  // Datos de entrada invalidos
  VALIDATION_02 = "VALIDATION_02",  // Token invalido
  RESOURCE_01 = "RESOURCE_01",      // Correo ya registrado
  RESOURCE_02 = "RESOURCE_02",      // Recurso no encontrado
  RESOURCE_03 = "RESOURCE_03",      // Sesion no encontrada
  AUTH_01 = "AUTH_01",              // Token invalido o expirado
  AUTH_02 = "AUTH_02",              // Token ya utilizado
  AUTH_03 = "AUTH_03",              // Credenciales invalidas
  AUTH_04 = "AUTH_04",              // Cuenta inactiva
  AUTH_05 = "AUTH_05",              // Token no proporcionado
  AUTH_06 = "AUTH_06",              // Contrasena actual incorrecta
  INTERNAL_01 = "INTERNAL_01",      // Error interno del servidor
  PERMISSION_01 = "PERMISSION_01",  // Acceso no autorizado
}
```

### SessionStatusFilter (scheduling/dto/session-filter.dto.ts L4-8)
```typescript
export enum SessionStatusFilter {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
```

---

## Diagrama de Relaciones (ER)

```
                                +------------------+
                                |     users        |
                                |------------------|
                                | PK id_user (uuid)|
                                | name             |
                                | email (unique)   |
                                | password         |
                                | role (enum)      |
                                | status (enum)    |
                                | email_verified   |
                                | ...timestamps    |
                                +--------+---------+
                                    |1        |1
                            +-------+        +-------+
                            |                         |
                       +----v-----+             +-----v----+
                       | students |             |  tutors   |
                       |----------|             |-----------|
                       |PK id_user|             |PK id_user |
                       | career   |             | phone     |
                       | pref_mod |             | is_active |
                       +----+-----+             | limit_disp|
                            |                   | profile_c |
                   +--------+--------+          | url_image |
                   |                 |          +-----+-----+
              +----v---------+  +----v--------+       |
              | student_int  |  | stud_part   |  +----+--------+
              | _subject     |  | _session    |  |             |
              |PK id_student |  |PK id_student|  |    +--------v--------+
              |PK id_subject |  |PK id_session|  |    | tutor_impart    |
              +--------------+  | status      |  |    | _subject        |
                                | comment     |  |    |PK id_tutor      |
                                +------+------+  |    |PK id_subject    |
                                       |         |    +---------+-------+
                                       |         |              |
                                  +----v---------v----+   +----v------+
                                  |     sessions      |   |  subject  |
                                  |-------------------|   |-----------|
                                  |PK id_session(uuid)|   |PK id_subj |
                                  |FK id_tutor        |   | name (uniq|
                                  |FK id_subject      |   | is_active |
                                  | scheduled_date    |   +-----------+
                                  | start_time        |
                                  | end_time          |
                                  | title, description|
                                  | type, modality    |
                                  | location, v_link  |
                                  | status            |
                                  | cancel fields...  |
                                  | tutor_confirmed   |
                                  | rejection fields..|
                                  +--------+----------+
                                      |1       |1..N
                              +-------+    +---v---------------------+
                              |            | session_modification    |
                         +----v---------+  | _requests               |
                         | scheduled    |  |PK id_request (uuid)     |
                         | _sessions    |  |FK id_session             |
                         |PK id_session |  |FK requested_by (user)    |
                         |FK id_tutor   |  | new_date, new_time...    |
                         |FK id_avail   |  | status, expires_at       |
                         | sched_date   |  +-------------------------+
                         +----+---------+
                              |
                         +----v---------+
                         | availability |
                         |PK id_avail   |
                         | day_of_week  |       +-------------------+
                         | start_time   |       | tutor_have_avail  |
                         +----+---------+       |PK id_tutor        |
                              |                 |PK id_availability  |
                              +---------<-------| modality           |
                                                +-------------------+

    AUTH DOMAIN:
    +-----------------+  +---------------------+  +----------------------+
    | auth_sessions   |  | password_reset      |  | email_verification   |
    |PK id_session    |  | _tokens             |  | _tokens              |
    |FK user (cascade)|  |PK id_token          |  |PK id_token           |
    | refresh_token_h |  |FK id_user (cascade) |  |FK id_user (cascade)  |
    | user_agent      |  | token_hash          |  | token_hash           |
    | expires_at      |  | expires_at          |  | expires_at           |
    | revoked_at      |  | used_at             |  | verified_at          |
    | last_activity   |  +---------------------+  +----------------------+
    +-----------------+

    +-------------------+       EVALUATION:
    | audit_logs        |       +------------+     +------------+
    |PK id_log          |       | questions  |     | answers    |
    |FK id_user (null)  |       |PK id_quest |     |PK id_quest |
    |FK id_session(null)|       | content    |     |PK id_stud  |
    | action (enum)     |       +------+-----+     |PK id_sess  |
    | result (enum)     |              |           | score      |
    | email_attempted   |              +---<-------+------------+
    | failure_reason    |
    | ip_address        |
    | user_agent        |
    | metadata (jsonb)  |
    +-------------------+
```

---

## Migraciones

Ambas migraciones estan COMENTADAS (no se ejecutan):

1. **1771187324485-remove-subject-code.ts**: Elimina columna `code` y constraint UNIQUE de `subjects`
2. **1771187766530-remove-subject-timestamps.ts**: Cambia default de `tutors.isActive`

**Nota**: El sistema usa `synchronize: false` en la configuracion, por lo que las migraciones deben ejecutarse manualmente. Sin embargo, las migraciones estan comentadas, lo que indica que el schema se esta manejando de otra forma (posiblemente sincronizacion manual o scripts SQL directos).

---

## Seeders

El seeder de materias esta COMENTADO. Contiene 9 materias predefinidas:
- Calculo Diferencial, Calculo Integral, Ecuaciones Diferenciales
- Matematicas Discretas, Algebra Lineal, Fisica Newtoniana
- Programacion Basica, Programacion Orientada a Objetos, Programacion Avanzada
