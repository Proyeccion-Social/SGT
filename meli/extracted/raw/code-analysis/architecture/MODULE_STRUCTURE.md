# Estructura de Modulos y Arquitectura - atlas-sgt

## Fecha de extraccion: 2026-03-31

---

## 1. Patron Arquitectonico

**Patron**: Arquitectura Modular NestJS (variante de Layered Architecture)
**Confianza**: ALTA

Cada modulo sigue una estructura interna por capas:
```
module/
  controllers/   -> Capa de presentacion (endpoints HTTP)
  services/      -> Capa de logica de negocio
  entities/      -> Capa de datos (entidades TypeORM)
  dto/           -> Data Transfer Objects (validacion de entrada)
  enums/         -> Constantes tipadas
  guards/        -> Middleware de autorizacion (solo en auth)
  decorators/    -> Decorators personalizados (solo en auth)
  strategies/    -> Estrategias Passport (solo en auth)
  interfaces/    -> Interfaces TypeScript (solo en auth)
  exceptions/    -> Excepciones personalizadas (solo en auth)
  filters/       -> Exception filters (solo en auth)
  validators/    -> Validadores personalizados (solo en availability)
```

---

## 2. Modulos del Sistema

### Diagrama de Dependencias

```
AppModule
  |
  +-- ConfigModule (global, .env con Joi)
  +-- DatabaseModule (TypeORM PostgreSQL, conexion 'local')
  |
  +-- AuthModule
  |     +-- imports: UsersModule, StudentModule, TutorModule, NotificationsModule
  |     +-- exports: AuthService, TypeOrmModule, JwtModule
  |
  +-- UsersModule
  |     +-- exports: UserService, TypeOrmModule
  |
  +-- StudentModule
  |     +-- exports: StudentService, TypeOrmModule
  |
  +-- TutorModule
  |     +-- imports: SubjectsModule, NotificationsModule, UsersModule
  |     +-- exports: TutorService, TypeOrmModule
  |
  +-- SubjectsModule
  |     +-- exports: SubjectsService, TypeOrmModule
  |
  +-- AvailabilityModule
  |     +-- imports: SubjectsModule, TutorModule, AuthModule
  |     +-- exports: AvailabilityService, TypeOrmModule
  |
  +-- SchedulingModule
  |     +-- imports: AuthModule, AvailabilityModule, TutorModule, UsersModule, SubjectsModule, NotificationsModule
  |     +-- exports: SessionService, TypeOrmModule
  |
  +-- EvaluationModule (session-execution)
  |     +-- exports: EvaluationService, TypeOrmModule
  |
  +-- NotificationsModule
        +-- imports: ConfigModule
        +-- exports: NotificationsService
```

### Detalle por Modulo

#### 2.1 AppModule
- **Archivo**: `/src/app.module.ts`
- **Prefijo global**: `api/v1` (definido en `/src/main.ts` L7)
- **Puerto**: `process.env.PORT ?? 3000`
- **Responsabilidad**: Modulo raiz, orquesta todos los demas modulos

#### 2.2 DatabaseModule
- **Archivo**: `/src/modules/database/database.module.ts`
- **Responsabilidad**: Configuracion de conexiones TypeORM
- **Conexiones**:
  - `local` (PostgreSQL local, ACTIVA)
  - `neon` (PostgreSQL Neon, COMENTADA)
- **Entidades registradas**: 18 entidades (User, Student, Tutor, Subject, TutorImpartSubject, StudentInterestedSubject, Availability, TutorHaveAvailability, Session, ScheduledSession, SessionModificationRequest, StudentParticipateSession, Question, Answer, AuthSession, AuditLog, PasswordResetToken, EmailVerificationToken)
- **Synchronize**: `false` (explicitamente deshabilitado)

#### 2.3 AuthModule
- **Archivo**: `/src/modules/auth/auth.module.ts`
- **Controller**: AuthController (`/auth`)
- **Servicios**: AuthService, SessionService, AuditService, PasswordResetService, EmailVerificationService
- **Estrategias**: JwtStrategy (Bearer token)
- **Guards exportados**: JwtAuthGuard, RolesGuard
- **Responsabilidad**: Registro de estudiantes, login/logout, gestion de tokens JWT, verificacion de email, recuperacion de contrasena, auditoria de accesos, gestion de sesiones de autenticacion

#### 2.4 UsersModule
- **Archivo**: `/src/modules/users/users.module.ts`
- **Controller**: UsersController (`/users`) -- VACIO, sin endpoints
- **Servicio**: UserService
- **Responsabilidad**: CRUD de usuarios, hashing de contrasenas, gestion de bloqueo de cuentas

#### 2.5 StudentModule
- **Archivo**: `/src/modules/student/student.module.ts`
- **Controller**: StudentsController (`/students`) -- VACIO, sin endpoints
- **Servicio**: StudentService
- **Responsabilidad**: Creacion de perfil de estudiante, verificacion de completitud

#### 2.6 TutorModule
- **Archivo**: `/src/modules/tutor/tutor.module.ts`
- **Controller**: TutorsController (`/tutors`)
- **Servicio**: TutorService
- **Responsabilidad**: Creacion de tutores (por admin), completar perfil, activar/desactivar, perfil publico, asignacion de materias

#### 2.7 SubjectsModule
- **Archivo**: `/src/modules/subjects/subjects.module.ts`
- **Controller**: SubjectsController (`/subjects`)
- **Servicio**: SubjectsService
- **Responsabilidad**: CRUD de materias, gestion de relaciones tutor-materia y estudiante-materia

#### 2.8 AvailabilityModule
- **Archivo**: `/src/modules/availability/availability.module.ts`
- **Controller**: AvailabilityController (`/availability`)
- **Servicio**: AvailabilityService
- **Responsabilidad**: Gestion de franjas de disponibilidad de tutores (crear, actualizar, eliminar slots de 30 min), consulta publica de disponibilidad

#### 2.9 SchedulingModule
- **Archivo**: `/src/modules/scheduling/scheduling.module.ts`
- **Controller**: SessionController (`/scheduling/sessions`)
- **Servicios**: SessionService, SessionValidationService
- **Responsabilidad**: Agendamiento de sesiones de tutoria, confirmacion/rechazo por tutor, cancelacion, modificacion, consulta

#### 2.10 EvaluationModule (session-execution)
- **Archivo**: `/src/modules/session-execution/session-execution.ts`
- **Controllers**: EvaluationController (`/evaluation`) -- VACIO, TutorRatingsController (`/tutor-ratings`) -- VACIO
- **Servicios**: EvaluationService -- VACIO, RatingQueryService -- VACIO
- **Estado**: ESQUELETO SIN IMPLEMENTAR. Solo tiene entidades (Question, Answer) y controllers/servicios vacios.

#### 2.11 NotificationsModule
- **Archivo**: `/src/modules/notifications/notifications.module.ts`
- **Controller**: NotificationsController (`/notifications`) -- VACIO, sin endpoints
- **Servicio**: NotificationsService (completo, con metodos para emails de registro, login, tutores, sesiones, modificaciones, recordatorios, evaluaciones)
- **Proveedor de email**: Resend API
- **Templates**: Handlebars (.hbs)

#### 2.12 CommonModule (no es un modulo formal)
- **Archivos**: `/src/modules/common/dto/pagination.dto.ts`, `/src/modules/common/helpers/pagination.helper.ts`
- **Responsabilidad**: DTOs y helpers compartidos para paginacion

---

## 3. Patrones de Diseno Detectados

| Patron | Ubicacion | Confianza |
|--------|-----------|-----------|
| Module Pattern | Todos los modulos NestJS | ALTA |
| Repository Pattern | Via TypeORM `@InjectRepository` en todos los servicios | ALTA |
| Strategy Pattern | `JwtStrategy` (Passport) | ALTA |
| Guard Pattern | `JwtAuthGuard`, `RolesGuard` | ALTA |
| Decorator Pattern | `@CurrentUser`, `@Public`, `@Roles`, `@IsInstitutionalEmail`, `@Match`, `@IsThirtyMinuteIncrement` | ALTA |
| Service Layer | Separacion clara controller -> service -> repository | ALTA |
| DTO Pattern | Validacion de entrada con class-validator en todos los endpoints | ALTA |
| Exception Filter | `BusinessExceptionFilter` para excepciones de negocio | ALTA |
| Cron Job | `SessionService.cleanupExpiredSessions` (diario a medianoche) | ALTA |
| Transaction Pattern | `DataSource.transaction()` en `SessionService.createIndividualSession` | ALTA |

---

## 4. Convenciones de Codigo

- **Archivos**: kebab-case (ej: `session-validation.service.ts`)
- **Clases**: PascalCase (ej: `SessionValidationService`)
- **Variables/Props**: camelCase (ej: `idSession`, `startTime`)
- **Columnas BD**: snake_case (ej: `id_session`, `start_time`)
- **Tablas BD**: snake_case plural (ej: `users`, `sessions`, `audit_logs`)
- **Enums**: UPPER_SNAKE_CASE para valores (ej: `SCHEDULED`, `PENDING_MODIFICATION`)
- **Rutas API**: kebab-case con prefijo `api/v1/`
- **IDs**: UUID v4 para la mayoria, bigint auto-increment para `Availability`

---

## 5. Archivos de Infraestructura

| Archivo | Proposito |
|---------|-----------|
| `/src/main.ts` | Bootstrap de la aplicacion, prefijo global `api/v1` |
| `/src/app.module.ts` | Modulo raiz |
| `/src/config/env.config.ts` | Validacion de variables de entorno con Joi |
| `/src/db/data-source.ts` | DataSource para migraciones (COMENTADO) |
| `/src/db/migrations/` | 2 migraciones (COMENTADAS) |
| `/src/seeders/` | Seeder de materias (COMENTADO) |
| `/nest-cli.json` | Configuracion del CLI de NestJS |
| `/tsconfig.json` | TypeScript config (target ES2023, module nodenext) |
| `/tsconfig.build.json` | Config de build |
| `/eslint.config.mjs` | Config de ESLint |
