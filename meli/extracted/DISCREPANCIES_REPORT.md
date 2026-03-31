# Phase 3: DISCREPANCIES_REPORT.md
## SGT (Sistema de Gestion de Tutorias) - Validacion Profunda y Discrepancias

**Fecha de generacion**: 2026-03-31
**Repositorio**: atlas-sgt
**Branch**: `feature/add-external-config-edition`
**Metodo**: Analisis estatico del codigo fuente, cross-referencing entre modulos

---

## CRITICO -- Problemas que pueden causar errores en runtime

### C-01: ValidationPipe NO esta habilitado globalmente

**Severidad**: CRITICO
**Archivos afectados**:
- `/src/main.ts` (L1-10) -- No llama a `app.useGlobalPipes(new ValidationPipe())`
- `/src/app.module.ts` (L1-36) -- No registra `APP_PIPE`

**Descripcion**: El proyecto utiliza `class-validator` y `class-transformer` extensivamente en los DTOs (decoradores como `@IsNotEmpty`, `@IsEmail`, `@MinLength`, `@Matches`, `@IsEnum`, etc.), pero **nunca habilita el `ValidationPipe`** de NestJS. Esto significa que ninguna validacion de DTO se ejecuta realmente en runtime. Cualquier payload invalido sera aceptado sin error.

**DTOs afectados (todos)**: `RegisterDto`, `RegisterStudentDto`, `LoginDto`, `CreateTutorDto`, `CompleteTutorProfileDto`, `ChangePasswordDto`, `AssignSubjectsDto`, `ManageSlotsDto`, `CreateIndividualSessionDto`, `ProposeModificationDto`, `PaginationDto`, y todos los demas.

**Evidencia**: Busqueda de `ValidationPipe` en todo `/src/` retorna 0 resultados.

---

### C-02: Enumeraciones duplicadas con valores INCOMPATIBLES

**Severidad**: CRITICO
**Archivos afectados**:

**UserRole** -- Dos definiciones con valores diferentes:
- `/src/modules/users/entities/user.entity.ts` L15-19:
  ```typescript
  export enum UserRole {
    STUDENT = 'STUDENT',
    TUTOR = 'TUTOR',
    ADMIN = 'ADMIN',
  }
  ```
- `/src/modules/auth/enums/user-roles.enum.ts` L1-5:
  ```typescript
  export enum UserRole {
    STUDENT = "Student",
    TUTOR = "Tutor",
    ADMIN = "Admin",
  }
  ```

**UserStatus** -- Dos definiciones con valores Y miembros diferentes:
- `/src/modules/users/entities/user.entity.ts` L21-25:
  ```typescript
  export enum UserStatus {
    ACTIVE = 'ACTIVE',
    PENDING = 'PENDING',
    BLOCKED = 'BLOCKED',
  }
  ```
- `/src/modules/auth/enums/user-status.enum.ts` L1-5:
  ```typescript
  export enum UserStatus {
    PENDING = "Pending",
    ACTIVE = "Active",
    INACTIVE = "Inactive",
    SUSPENDED = "Suspended",
  }
  ```

**Impacto**: Los valores en la entidad (`'STUDENT'`, `'ACTIVE'`) son los que se persisten en la base de datos. Los enums en `auth/enums/` tienen valores con capitalizacion diferente (`"Student"`, `"Active"`) y miembros extra (`INACTIVE`, `SUSPENDED`). Si alguien importa desde `auth/enums/` en vez de `user.entity.ts`, las comparaciones y queries fallarian.

**Estado actual**: Todas las importaciones en el codigo usan la version de `user.entity.ts` (confirmado con grep). Los enums en `auth/enums/` son codigo muerto pero peligroso.

---

### C-03: README.md con conflicto de merge sin resolver

**Severidad**: CRITICO
**Archivo**: `/README.md` (L1-121)

**Descripcion**: El archivo completo tiene marcadores de conflicto de merge activos:
- Linea 1: `<<<<<<< HEAD`
- Linea 22: `=======`
- Linea 121: `>>>>>>> ed63571 (First commit)`

Contiene dos versiones incompatibles: una personalizada para SGT (lineas 2-21) y el README default de NestJS (lineas 23-120). Ningun parser de Markdown puede renderizar este archivo correctamente.

---

### C-04: DATABASE_SETUP.md afirma que `synchronize` esta habilitado en desarrollo

**Severidad**: CRITICO
**Archivo**: `/DATABASE_SETUP.md` L91

**Texto del documento**:
> "En desarrollo (NODE_ENV=development), TypeORM sincronizara automaticamente el esquema de la base de datos con las entidades."

**Realidad en el codigo** (`/src/modules/database/database.module.ts` L76):
```typescript
synchronize: false,
```

`synchronize` esta en `false` de forma incondicional, sin importar el entorno. La documentacion es falsa y potencialmente confusa -- un desarrollador podria asumir que los cambios en entidades se aplican automaticamente.

---

## WARNING -- Problemas que indican codigo incompleto o inconsistente

### W-01: BusinessException y BusinessExceptionFilter definidos pero nunca utilizados

**Severidad**: WARNING
**Archivos definidos**:
- `/src/modules/auth/exceptions/business.exception.ts` -- Clase `BusinessException` con `ErrorCode`
- `/src/modules/auth/filters/business-exception.filter.ts` -- Filtro `BusinessExceptionFilter`
- `/src/modules/auth/enums/error-codes.enum.ts` -- 12 codigos de error definidos
- `/src/modules/auth/interfaces/bussines-exception-response.interface.ts` -- Interfaz de respuesta (nota: typo en nombre `bussines`)

**Evidencia**: Busqueda de `BusinessException` en `**/services/*.ts` retorna 0 resultados. El filtro no esta registrado en ningun modulo ni globalmente en `main.ts`. Todos los servicios usan directamente `NotFoundException`, `BadRequestException`, `ForbiddenException` de `@nestjs/common`.

**Impacto**: Se diseno un sistema de excepciones custom con codigos de error (`VALIDATION_01`, `AUTH_03`, etc.) que nunca se implemento. Los clientes de la API no reciben codigos de error estructurados.

---

### W-02: RegisterStudentDto existe pero nunca se usa

**Severidad**: WARNING
**Archivo**: `/src/modules/auth/dto/register-student.dto.ts` (L1-32)

**Descripcion**: El DTO `RegisterStudentDto` tiene campo `fullName` (en vez de `name`), validaciones con `class-validator`, y decorador `@Match("password")`. Sin embargo, no es importado ni usado por ningun controlador ni servicio. El endpoint `POST /api/v1/auth/register` usa `RegisterDto` (que tiene campo `name`).

**Diferencias con RegisterDto**:
- `RegisterStudentDto.fullName` vs `RegisterDto.name`
- `RegisterStudentDto` incluye `@IsInstitutionalEmail` y `@Match` decoradores
- `RegisterDto` es el que realmente se usa

---

### W-03: Controladores vacios (6 controladores shell)

**Severidad**: WARNING

| Controlador | Archivo | Estado |
|-------------|---------|--------|
| `UsersController` | `/src/modules/users/controllers/users.controller.ts` | Shell vacio -- 0 endpoints |
| `StudentsController` | `/src/modules/student/controllers/student.controller.ts` | Shell vacio -- 0 endpoints |
| `NotificationsController` | `/src/modules/notifications/controllers/notifications.controller.ts` | Shell vacio -- 0 endpoints |
| `EvaluationController` | `/src/modules/session-execution/controllers/evaluation.controller.ts` | Shell vacio -- comentarios con endpoints planificados |
| `TutorRatingsController` | `/src/modules/session-execution/controllers/tutor-ratings.controller.ts` | Shell vacio -- comentarios con endpoints planificados |
| `AttendanceController` | `/src/modules/session-execution/controllers/attendance.controller.ts` | Archivo vacio (0 lineas de contenido) |

**Evidencia**: `EvaluationController` tiene endpoints planificados en comentarios:
```
POST /api/v1/session-execution/sessions/{sessionId}/evaluation
GET  /api/v1/session-execution/sessions/{sessionId}/evaluation
```
`TutorRatingsController` tiene endpoints planificados en comentarios:
```
GET /api/v1/session-execution/tutors/{tutorId}/evaluations
GET /api/v1/session-execution/tutors/{tutorId}/stats
```

Ninguno esta implementado.

---

### W-04: Servicio de asistencia vacio

**Severidad**: WARNING
**Archivo**: `/src/modules/session-execution/services/attendance.service.ts` -- Archivo existe pero tiene 0 lineas de contenido (vacio).

---

### W-05: Entidad SessionModality completamente comentada

**Severidad**: WARNING
**Archivo**: `/src/modules/scheduling/enums/session-modality.enum.ts` (L1-6)

```typescript
// src/scheduling/enums/session-modality.enum.ts
/*export enum SessionModality {
  PRES = 'PRES',
  VIRT = 'VIRT',
}
  */
```

**Descripcion**: El enum `SessionModality` fue reemplazado por `Modality` de `/src/modules/availability/enums/modality.enum.ts`. El archivo deberia eliminarse para evitar confusion.

---

### W-06: @nestjs/throttler importado pero no configurado

**Severidad**: WARNING
**Archivo**: `/package.json` L33 -- `"@nestjs/throttler": "^6.5.0"`

**Descripcion**: El paquete de rate limiting esta instalado como dependencia pero:
- No se importa `ThrottlerModule` en ninguno de los modulos
- No hay `ThrottlerGuard` registrado
- No hay decoradores `@Throttle()` en ningun endpoint

**Impacto**: La API no tiene rate limiting, lo cual es relevante dado que maneja autenticacion (login, reset de contrasena, verificacion de email). El bloqueo de cuenta tras 5 intentos es una mitigacion parcial pero no equivalente a rate limiting real.

---

### W-07: Conexion Neon (produccion) completamente comentada

**Severidad**: WARNING
**Archivo**: `/src/modules/database/database.module.ts` L81-99

**Descripcion**: El bloque completo de configuracion para la base de datos Neon (produccion con SSL) esta dentro de un comentario `/* ... */`. DATABASE_SETUP.md documenta dos conexiones (`local` y `neon`) como si ambas estuvieran activas.

---

### W-08: Valores placeholder en perfil publico del tutor

**Severidad**: WARNING
**Archivo**: `/src/modules/tutor/services/tutor.service.ts`

**Campos hardcodeados a 0 en metodos `getPublicProfile` (L205-209) y `getOwnProfile` (L273-275)**:
```typescript
const averageRating = 0;
const totalRatings = 0;
const completedSessions = 0;
const currentWeekHoursUsed = 0;
```

**Descripcion**: Cuatro campos de la respuesta del perfil publico del tutor siempre retornan `0`. Los comentarios dicen `(placeholder)`. Esto afecta directamente la experiencia del usuario -- nunca vera calificaciones ni conteo de sesiones completadas, y el calculo de `availableHoursThisWeek` siempre sera igual a `maxWeeklyHours`.

---

### W-09: Entidad AuthSession tiene propiedad con tipo `any`

**Severidad**: WARNING
**Archivo**: `/src/modules/auth/entities/session.entity.ts`

**Descripcion**: El campo `startTime` de la entidad `Session` (auth) usa tipo TypeScript `any`, lo cual elimina type-safety. Deberia ser `Date`.

---

### W-10: Typo en nombre de interfaz

**Severidad**: WARNING
**Archivo**: `/src/modules/auth/interfaces/bussines-exception-response.interface.ts`

**Descripcion**: El nombre del archivo y la interfaz usan `bussines` en vez de `business` (falta una 's'). Si bien no afecta funcionalidad (ademas, no se usa en runtime -- ver W-01), indica falta de revision de codigo.

---

## INFO -- Observaciones menores y hallazgos informativos

### I-01: Enums en auth/enums/ son codigo 100% muerto

**Archivos**:
- `/src/modules/auth/enums/user-roles.enum.ts`
- `/src/modules/auth/enums/user-status.enum.ts`
- `/src/modules/auth/enums/index.ts`

**Descripcion**: El barrel `index.ts` exporta `UserRole`, `UserStatus` y `ErrorCode`. Sin embargo:
- `UserRole` y `UserStatus` de `auth/enums/` no son importados en **ningun** archivo del proyecto (confirmado con grep). Todos usan las versiones de `user.entity.ts`.
- `ErrorCode` solo es importado por `BusinessException` y `BusinessExceptionResponse`, que tampoco se usan (ver W-01).

**Todo el directorio `auth/enums/` es codigo muerto** (excepto como definicion inerte).

---

### I-02: Migraciones y seeders no existen como archivos funcionales

**Archivos buscados**:
- `src/modules/**/migrations/*.ts` -- 0 resultados
- `src/modules/**/seeders/*.ts` -- 0 resultados

**Descripcion**: No hay archivos de migracion ni seeders en el proyecto. Historicamente existieron (referenciados en commits), pero fueron eliminados o estan en otra ubicacion. El `data-source.ts` esta completamente comentado. La base de datos se gestiona unicamente a traves de las entidades TypeORM.

---

### I-03: Console.log con contrasena temporal en produccion

**Archivo**: `/src/modules/tutor/services/tutor.service.ts` L54

```typescript
console.log('TEMP PASSWORD:', temporaryPassword);
```

**Descripcion**: La contrasena temporal generada para nuevos tutores se imprime en la consola del servidor. El comentario dice "para facilitar pruebas", pero si se despliega sin eliminar esta linea, las contrasenas quedan en los logs del servidor.

---

### I-04: Entidad EmailConfirmation referenciada pero comentada en todo el proyecto

**Archivos que la referencian (comentada)**:
- `/src/modules/users/entities/user.entity.ts` L13, L89-90
- `/src/modules/database/database.module.ts` L9, L58

**Descripcion**: La entidad `EmailConfirmation` fue reemplazada por `EmailVerificationToken`. Las referencias antiguas permanecen como comentarios. No genera error pero agrega ruido al codigo.

---

### I-05: TypeOrmModule importado pero no usado en AppModule

**Archivo**: `/src/app.module.ts` L13

```typescript
import { TypeOrmModule } from '@nestjs/typeorm';
```

**Descripcion**: El import existe pero `TypeOrmModule` no se usa en el array `imports` de `AppModule`. La configuracion real de TypeORM esta en `DatabaseModule`. Este import es innecesario.

---

### I-06: Campo `startTime` con tipo `any` en AuthSession

**Archivo**: `/src/modules/auth/entities/session.entity.ts`

**Descripcion**: Ademas del problema de tipado (W-09), este campo no tiene un decorador `@Column` claramente tipado, lo que puede causar problemas con la sincronizacion del esquema de la base de datos.

---

### I-07: Propiedad `preferredModality` en Student no se usa en ningun flujo

**Archivo**: `/src/modules/student/entities/student.entity.ts`

**Descripcion**: La entidad `Student` tiene un campo `preferredModality` de tipo enum (`PRES`/`VIRT`), pero no existe ningun endpoint para que el estudiante lo configure, ni se consulta en el flujo de creacion de sesiones. Es un campo huerfano sin flujo de entrada ni de consumo.

---

### I-08: DATABASE_SETUP.md menciona sincronizacion automatica en desarrollo

**Archivo**: `/DATABASE_SETUP.md` L84, L91

**Texto**:
> "Sincronizacion automatica habilitada en modo desarrollo"
> "En desarrollo (NODE_ENV=development), TypeORM sincronizara automaticamente el esquema"

**Realidad**: `synchronize: false` incondicional en `database.module.ts` L76. Esta discrepancia ya fue reportada como C-04 pero se incluye aqui como referencia cruzada.

---

## Resumen de Discrepancias

| ID | Severidad | Descripcion corta |
|----|-----------|-------------------|
| C-01 | CRITICO | ValidationPipe no habilitado -- validaciones de DTO no funcionan |
| C-02 | CRITICO | Enums UserRole/UserStatus duplicados con valores incompatibles |
| C-03 | CRITICO | README.md con merge conflict sin resolver |
| C-04 | CRITICO | DATABASE_SETUP.md afirma synchronize=true pero codigo tiene false |
| W-01 | WARNING | BusinessException/Filter/ErrorCode definidos pero nunca usados |
| W-02 | WARNING | RegisterStudentDto definido pero nunca usado |
| W-03 | WARNING | 6 controladores vacios (shell) |
| W-04 | WARNING | attendance.service.ts es archivo vacio |
| W-05 | WARNING | SessionModality enum completamente comentado |
| W-06 | WARNING | @nestjs/throttler instalado pero no configurado |
| W-07 | WARNING | Conexion Neon (produccion) comentada |
| W-08 | WARNING | Valores placeholder (0) en perfil del tutor |
| W-09 | WARNING | Tipo `any` en campo de AuthSession |
| W-10 | WARNING | Typo `bussines` en nombre de interfaz |
| I-01 | INFO | Directorio auth/enums/ completo es codigo muerto |
| I-02 | INFO | No existen migraciones ni seeders funcionales |
| I-03 | INFO | console.log con contrasena temporal |
| I-04 | INFO | EmailConfirmation comentada en multiples archivos |
| I-05 | INFO | Import innecesario de TypeOrmModule en AppModule |
| I-06 | INFO | Campo startTime con tipo any sin Column tipado |
| I-07 | INFO | preferredModality en Student es campo huerfano |
| I-08 | INFO | Referencia cruzada de C-04 |

**Total**: 4 CRITICOS, 10 WARNING, 8 INFO
