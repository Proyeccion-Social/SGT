# Patrones Descubiertos - atlas-sgt

**Fecha**: 2026-03-31
**Total**: 10 patrones

---

## HTTP/API

### Guard + Roles Pattern
**Categoria**: HTTP/API
**Evidencia**:
- `src/modules/auth/guards/jwt-auth.guard.ts`
- `src/modules/auth/guards/roles.guard.ts`
- `src/modules/scheduling/controllers/sessions.controller.ts:25`
- `src/modules/tutor/controllers/tutor.controller.ts:18`

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Post()
createTutor(@Body() dto: CreateTutorDto) { ... }
```
**Cuando usar**: En todo endpoint que requiera autenticacion y/o autorizacion por rol.

### Public Endpoint Pattern
**Categoria**: HTTP/API
**Evidencia**:
- `src/modules/auth/decorators/public.decorator.ts`
- `src/modules/auth/controllers/auth.controller.ts:43` (register)
- `src/modules/subjects/controllers/subjects.controller.ts:15` (getAll)
- `src/modules/tutor/controllers/tutor.controller.ts:131` (public profile)

```typescript
@Public()
@Post('register')
register(@Body() dto: RegisterDto) { ... }
```
**Cuando usar**: En endpoints accesibles sin autenticacion.

### CurrentUser Decorator Pattern
**Categoria**: HTTP/API
**Evidencia**:
- `src/modules/auth/decorators/current-user.decorator.ts`
- `src/modules/scheduling/controllers/sessions.controller.ts:46`
- `src/modules/auth/controllers/auth.controller.ts:108`

```typescript
@Post('logout')
logout(@CurrentUser() user: any, @Body() dto: RefreshTokenDto) { ... }
```
**Cuando usar**: Para extraer el usuario autenticado del request en cualquier endpoint protegido.

---

## Database

### TypeORM Repository Injection
**Categoria**: Database
**Evidencia**:
- `src/modules/auth/services/auth.service.ts:40`
- `src/modules/scheduling/services/session.service.ts:35`
- `src/modules/availability/services/availability.service.ts:28`
- `src/modules/tutor/services/tutor.service.ts:20`

```typescript
constructor(
  @InjectRepository(Session)
  private sessionRepository: Repository<Session>,
  @InjectRepository(ScheduledSession)
  private scheduledSessionRepository: Repository<ScheduledSession>,
) {}
```
**Cuando usar**: Para acceder a cualquier entidad TypeORM en un servicio.

### Transaction Pattern
**Categoria**: Database
**Evidencia**:
- `src/modules/scheduling/services/session.service.ts:228`

```typescript
return this.dataSource.transaction(async (manager) => {
  const session = manager.create(Session, { ... });
  await manager.save(session);
  const scheduled = manager.create(ScheduledSession, { ... });
  await manager.save(scheduled);
  // ...
});
```
**Cuando usar**: Cuando se deben crear/modificar multiples entidades atomicamente (ej: Session + ScheduledSession + StudentParticipateSession).

---

## Error Handling

### BusinessExceptionFilter
**Categoria**: Error Handling
**Evidencia**:
- `src/modules/auth/filters/business-exception.filter.ts`
- `src/modules/auth/exceptions/business.exception.ts`

```typescript
throw new BusinessException(
  HttpStatus.BAD_REQUEST,
  ErrorCode.VALIDATION_01,
  'Mensaje de error descriptivo',
);
```
**Cuando usar**: Para errores de logica de negocio con codigo de error estandarizado (ErrorCode enum).

### ErrorCode Enum Pattern
**Categoria**: Error Handling
**Evidencia**:
- `src/modules/auth/enums/error-codes.enum.ts`
- Usado en auth.service.ts, session.service.ts, availability.service.ts

```typescript
ErrorCode.VALIDATION_01  // Datos invalidos
ErrorCode.RESOURCE_02    // Recurso no encontrado
ErrorCode.AUTH_03        // Credenciales invalidas
```
**Cuando usar**: En toda excepcion de negocio para clasificacion consistente del error.

---

## Security

### Bcrypt Hash Pattern
**Categoria**: Security
**Evidencia**:
- `src/modules/auth/services/auth.service.ts` (passwords)
- `src/modules/auth/services/session.service.ts:22` (refresh tokens)
- `src/modules/auth/services/email-verification.service.ts:18` (tokens)
- `src/modules/users/services/users.service.ts:45` (passwords)

```typescript
const hash = await bcrypt.hash(plainText, 10);
const isValid = await bcrypt.compare(plainText, hash);
```
**Cuando usar**: Para hashear cualquier dato sensible (passwords, tokens). Siempre 10 rounds.

---

## Testing

### Jest Configuration
**Categoria**: Testing
**Evidencia**:
- `package.json` (jest config)
- `test/app.e2e-spec.ts`

```json
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```
**Cuando usar**: Archivos de test con sufijo `.spec.ts` en la misma carpeta que el codigo fuente.

---

## Notifications

### Resend + Handlebars Email Pattern
**Categoria**: Notifications
**Evidencia**:
- `src/modules/notifications/services/notifications.service.ts:25-30`
- `src/modules/notifications/templates/*.hbs`

```typescript
this.resend = new Resend(configService.get('RESEND_API_KEY'));
// ...
await this.resend.emails.send({
  from: this.fromEmail,
  to: email,
  subject: 'Subject',
  html: compiledTemplate(context),
});
```
**Cuando usar**: Para enviar cualquier email del sistema. Templates en Handlebars (.hbs).
