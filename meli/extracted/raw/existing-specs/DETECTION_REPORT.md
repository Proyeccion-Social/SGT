# DETECTION_REPORT.md - Estado del Repositorio atlas-sgt

## Fecha de analisis: 2026-03-31
## Branch analizado: feature/add-external-config-edition

---

## 1. Frameworks de Especificacion Detectados

| Framework | Detectado | Confianza | Evidencia |
|-----------|-----------|-----------|-----------|
| Meli SDD Kit | SI (parcial) | ALTA | Directorio `meli/` con `PROJECT.md`, `specs/`, `wip/`, `extracted/` |
| OpenAPI / Swagger | NO | ALTA | No existen archivos `openapi.yaml`, `swagger.yaml`, `swagger.json` |
| ADR / RFC | NO | ALTA | No existe `docs/adr/` ni `docs/rfc/` |
| CLAUDE.md | NO | ALTA | No existe `CLAUDE.md` en la raiz |
| .cursor/ | NO | ALTA | No existe directorio `.cursor/` |
| .kiro/ | NO | ALTA | No existe directorio `.kiro/` |
| .tessl/ | NO | ALTA | No existe directorio `.tessl/` |
| Codex | NO | ALTA | No existe `.codex/` |
| SpecStory | NO | ALTA | No existe `.specstory/` |
| ARCHITECTURE.md | NO | ALTA | No existe en la raiz |
| DESIGN.md | NO | ALTA | No existe en la raiz |

### Meli SDD Kit - Detalle

Existe una estructura inicial de Meli SDD Kit:

```
meli/
  PROJECT.md          -> Metadata del proyecto (nombre, stack, convenciones)
  specs/              -> Vacio (sin especificaciones formales)
  wip/                -> Vacio (sin trabajos en progreso)
  extracted/
    raw/
      code-analysis/  -> Vacio antes de esta extraccion
      existing-specs/ -> Este reporte
      mcpfury/        -> Vacio (N/A para este proyecto)
```

**Estado**: Estructura creada pero sin contenido previo. Esta es la primera extraccion completa.

---

## 2. Stack Tecnologico Detectado

### Confirmado por Codigo (Confianza ALTA)

| Componente | Tecnologia | Version | Evidencia |
|------------|------------|---------|-----------|
| Lenguaje | TypeScript | ^5.7.3 | `package.json` L75 |
| Runtime | Node.js | N/A (no .nvmrc) | `package.json` scripts |
| Framework | NestJS | ^11.1.12 | `package.json` L26 |
| Base de Datos | PostgreSQL | 12+ | `DATABASE_SETUP.md`, driver `pg` ^8.18.0 |
| ORM | TypeORM | ^0.3.28 | `package.json` L50, decorators en entidades |
| Autenticacion | JWT (Passport) | @nestjs/jwt ^11.0.2 | `package.json` L29-30 |
| Hashing | bcrypt | ^6.0.0 | `package.json` L36 |
| Validacion | class-validator + class-transformer | ^0.14.3 / ^0.5.1 | DTOs con decorators |
| Email | Resend | ^6.9.1 | `package.json` L48, NotificationsService |
| Templates | Handlebars | ^4.7.8 | `package.json` L41 |
| Scheduling | @nestjs/schedule (cron) | ^6.1.1 | `package.json` L33 |
| Rate Limiting | @nestjs/throttler | ^6.5.0 | `package.json` L34 (importado pero no configurado en AppModule) |
| Date Utils | date-fns | ^4.1.0 | `package.json` L39 |
| Config Validation | Joi | ^18.0.2 | `env.config.ts` |
| Testing | Jest | (dev) | `package.json` jest config |
| Linting | ESLint + Prettier | (dev) | `eslint.config.mjs`, scripts |

### Base de Datos - Conexiones

- **`local`**: PostgreSQL local para desarrollo (nombre de conexion TypeORM: `'local'`)
- **`neon`**: PostgreSQL Neon para produccion (comentado, no activo)
  - Archivo: `/src/modules/database/database.module.ts` L81-98

### Variables de Entorno Requeridas

Definidas en `/src/config/env.config.ts`:
- `LOCAL_DB_HOST`, `LOCAL_DB_PORT`, `LOCAL_DB_USER`, `LOCAL_DB_PASSWORD`, `LOCAL_DB_NAME`
- `NEON_DATABASE_URL` (opcional)
- `RESEND_API_KEY`, `RESEND_EMAIL`
- `JWT_SECRET` (min 32 chars), `JWT_EXPIRES_IN` (default: 15m)
- `JWT_REFRESH_SECRET` (min 32 chars), `JWT_REFRESH_EXPIRES_IN` (default: 7d)
- `PORT` (default: 3000), `NODE_ENV` (development/production/test)

---

## 3. Documentacion Existente

| Archivo | Contenido | Estado |
|---------|-----------|--------|
| `README.md` | Conflicto de merge sin resolver (<<<<<<< HEAD) | ROTO - tiene merge conflict |
| `DATABASE_SETUP.md` | Guia de configuracion de BD | Parcialmente actualizado (no menciona entidades de auth nuevas) |
| `PULL_REQUEST_TEMPLATE.md` | Template para PRs | Funcional |
| `meli/PROJECT.md` | Metadata del proyecto SDD Kit | Funcional |

---

## 4. Estrategia de Optimizacion Seleccionada

**CODE-ONLY EXTRACTION** (sin specs previas que comparar)

Dado que:
1. No existen especificaciones formales previas (OpenAPI, ADR, etc.)
2. El directorio `meli/specs/` esta vacio
3. El README tiene un merge conflict y es minimal
4. La unica documentacion real es `DATABASE_SETUP.md`

La estrategia es **extraccion exhaustiva desde el codigo fuente** como unica fuente de verdad.
