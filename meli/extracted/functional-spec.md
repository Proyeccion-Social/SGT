# Especificacion Funcional - atlas-sgt

**Version**: 1.0.0
**Fecha**: 2026-03-31
**Confianza global**: 🔸 CODE_ONLY (sin documentacion externa)

---

## 1. Contexto del Sistema

### 1.1 Descripcion General

atlas-sgt (Sistema de Gestion de Tutorias) es una plataforma web para la Universidad Distrital que conecta estudiantes con tutores academicos. Permite agendar, gestionar y dar seguimiento a sesiones de tutoria presenciales y virtuales.

### 1.2 Actores del Sistema

| Actor | Tipo | Rol | Autenticacion |
|-------|------|-----|---------------|
| Estudiante | Humano | Solicita tutorias, participa en sesiones | JWT (registro propio) |
| Tutor | Humano | Ofrece tutorias, gestiona disponibilidad | JWT (creado por admin) |
| Admin | Humano | Administra el sistema, crea tutores, audita | JWT (precreado) |
| Sistema (Cron) | Automatico | Limpia sesiones expiradas | Interno |
| Resend API | Externo | Servicio de envio de emails | API Key |

### 1.3 Dominio Institucional

- Solo emails `@udistrital.edu.co` pueden registrarse 🔸
- Tutores son creados por el admin (no se registran solos) 🔸

---

## 2. Casos de Uso

### CU-01: Registro de Estudiante
- **Actor**: Estudiante (no autenticado)
- **Confianza**: 🔸 CODE_ONLY
- **Precondiciones**: Email `@udistrital.edu.co` no registrado
- **Flujo principal**:
  1. Estudiante envia nombre, email institucional, contrasena
  2. Sistema valida formato (nombre 3-255 chars, password min 8 + mayusculas + minusculas + numeros + especiales)
  3. Sistema crea usuario con rol STUDENT, status PENDING, emailVerified=false
  4. Sistema crea perfil de estudiante asociado
  5. Sistema envia email de verificacion (token expira en 24h)
  6. Sistema registra auditoria (ACCOUNT_CREATED)
- **Postcondiciones**: Usuario creado en estado PENDING
- **Errores**: Email duplicado, formato invalido, dominio no institucional

### CU-02: Verificacion de Email
- **Actor**: Estudiante
- **Confianza**: 🔸 CODE_ONLY
- **Precondiciones**: Token de verificacion valido (< 24h)
- **Flujo**: Estudiante hace click en link del email -> Sistema valida token -> Marca emailVerified=true, status=ACTIVE -> Envia email de bienvenida
- **Errores**: Token expirado, token ya usado, token invalido

### CU-03: Login
- **Actor**: Estudiante, Tutor, Admin
- **Confianza**: 🔸 CODE_ONLY
- **Precondiciones**: Cuenta activa y verificada
- **Flujo principal**:
  1. Usuario envia email y contrasena
  2. Sistema verifica que no esta bloqueado (max 5 intentos, bloqueo 15 min)
  3. Sistema valida credenciales
  4. Sistema genera accessToken (1h) y refreshToken (30d)
  5. Sistema crea sesion de autenticacion
  6. Sistema registra auditoria (LOGIN)
- **Flujo alterno - Tutor nuevo**: Indica requiresPasswordChange=true y/o requiresProfileCompletion=true
- **Errores**: Credenciales invalidas, cuenta bloqueada, email no verificado

### CU-04: Recuperacion de Contrasena
- **Actor**: Cualquier usuario
- **Confianza**: 🔸 CODE_ONLY
- **Flujo**: Solicita reset -> recibe email con token (1h) -> envia nueva contrasena -> todas las sesiones se revocan

### CU-05: Cambio de Contrasena
- **Actor**: Usuario autenticado
- **Confianza**: 🔸 CODE_ONLY
- **Flujo**: Envia contrasena actual + nueva -> Sistema valida -> Actualiza contrasena -> Revoca todas las sesiones

### CU-06: Creacion de Tutor (Admin)
- **Actor**: Admin
- **Confianza**: 🔸 CODE_ONLY
- **Flujo**:
  1. Admin envia nombre y email institucional
  2. Sistema genera contrasena temporal (formato: `Tutor{year}!{random}`)
  3. Crea usuario con rol TUTOR, status ACTIVE, emailVerified=true
  4. password_changed_at = null (indica contrasena temporal)
  5. Envia credenciales por email al tutor

### CU-07: Completar Perfil de Tutor
- **Actor**: Tutor
- **Confianza**: 🔸 CODE_ONLY
- **Precondiciones**: Tutor debe haber cambiado la contrasena temporal
- **Flujo**:
  1. Tutor envia: telefono (10 digitos), foto (URL), horas semanales max (1-40), materias (min 1 UUID), disponibilidades opcionales
  2. Sistema marca profile_completed=true, isActive=true
- **Reglas**: No puede completar perfil si aun tiene contrasena temporal

### CU-08: Activar/Desactivar Tutor (Admin)
- **Actor**: Admin
- **Confianza**: 🔸 CODE_ONLY
- **Flujo**: Admin cambia estado isActive del tutor
- **Regla**: Si se desactiva, se eliminan TODAS las asignaciones de materias del tutor

### CU-09: Gestion de Disponibilidad del Tutor
- **Actor**: Tutor
- **Confianza**: 🔸 CODE_ONLY
- **Operaciones**: CREATE, UPDATE, DELETE de slots
- **Reglas de negocio**:
  - Slots fijos de 30 minutos 🔸
  - Maximo 8 slots por dia (4 horas) 🔸, excepto si solo tiene 1 dia disponible
  - Horarios solo en incrementos de 30 minutos (HH:00 o HH:30)
  - No solapamiento en mismo dia/hora
  - No se puede cambiar el dia de semana de un slot (eliminar y crear nuevo)
  - Dias disponibles: Lunes a Sabado (sin Domingo)

### CU-10: Consulta de Tutores por Materia
- **Actor**: Cualquiera (publico)
- **Confianza**: 🔸 CODE_ONLY
- **Flujo**: Buscar tutores por materia con filtros (modalidad, solo disponibles)
- **Paginacion**: Default 10, max 50

### CU-11: Agendar Sesion Individual
- **Actor**: Estudiante
- **Confianza**: 🔸 CODE_ONLY
- **Flujo**:
  1. Estudiante selecciona tutor, materia, franja, fecha, modalidad, duracion, titulo, descripcion
  2. Sistema valida:
     - Estudiante no es el mismo tutor
     - Tutor activo con perfil completo
     - Tutor imparte la materia
     - Franja existe y coincide en modalidad
     - Fecha coincide con dia de semana de la franja
     - Sin conflictos de horario
     - No excede limite semanal de horas del tutor
     - Franja disponible para esa fecha
  3. Crea Session + ScheduledSession + StudentParticipateSession en transaccion
  4. Estado inicial: PENDING_TUTOR_CONFIRMATION
  5. Notifica al tutor por email
- **Duraciones permitidas**: 1h, 1.5h, 2h 🔸
- **Campos titulo**: 5-100 chars, descripcion: 10-500 chars 🔸

### CU-12: Confirmar/Rechazar Sesion (Tutor)
- **Actor**: Tutor asignado
- **Confianza**: 🔸 CODE_ONLY
- **Confirmar**: Solo PENDING_TUTOR_CONFIRMATION -> SCHEDULED, notifica al estudiante
- **Rechazar**: Solo PENDING_TUTOR_CONFIRMATION -> REJECTED_BY_TUTOR, requiere razon (10-500 chars)

### CU-13: Cancelar Sesion
- **Actor**: Estudiante, Tutor, Admin
- **Confianza**: 🔸 CODE_ONLY
- **Reglas**:
  - Requiere razon (10-500 chars)
  - Se registra si fue cancelada dentro de las 24h previas a la sesion 🔸
  - Estudiante: solo sesiones donde participa
  - Tutor: solo sesiones que le pertenecen
  - Admin: cualquier sesion
  - Estado -> CANCELLED_BY_{ROLE}
  - Notifica a ambas partes por email

### CU-14: Proponer Modificacion de Sesion
- **Actor**: Estudiante o Tutor participante
- **Confianza**: 🔸 CODE_ONLY
- **Precondiciones**: Sesion en estado SCHEDULED
- **Flujo**:
  1. Propone cambios (fecha, franja, modalidad, duracion)
  2. Debe proponer al menos un cambio
  3. Sistema valida nueva fecha/franja/horario/limite semanal
  4. Estado -> PENDING_MODIFICATION
  5. Solicitud expira en 24 horas 🔸
  6. Notifica a la contraparte
- **Aceptar**: La contraparte acepta -> aplica cambios -> SCHEDULED
- **Rechazar**: Restaura estado a SCHEDULED

### CU-15: Actualizar Detalles Menores de Sesion
- **Actor**: Tutor
- **Confianza**: 🔸 CODE_ONLY
- **Campos editables**: titulo, descripcion, location, virtualLink
- **Regla**: NO requiere aprobacion del estudiante, solo notifica

### CU-16: Consultar Sesiones
- **Actor**: Estudiante, Tutor, Admin
- **Confianza**: 🔸 CODE_ONLY
- **Vistas**: Detalle individual, mis sesiones (estudiante), mis sesiones (tutor)
- **Filtros**: status (SCHEDULED, COMPLETED, CANCELLED), paginacion

### CU-17: Auditoria de Accesos (Admin)
- **Actor**: Admin
- **Confianza**: 🔸 CODE_ONLY
- **Flujo**: Consulta logs con filtros (userId, action, result, fechas, IP)
- **Exportar**: CSV con limite de 10,000 registros 🔸
- **Paginacion**: Default 20 🔸

---

## 3. Reglas de Negocio

### RN-01: Dominio Institucional
Todos los emails deben ser `@udistrital.edu.co` 🔸

### RN-02: Bloqueo por Intentos Fallidos
Maximo 5 intentos de login fallidos -> bloqueo de 15 minutos 🔸

### RN-03: Expiracion de Tokens
| Token | Expiracion |
|-------|-----------|
| Access Token JWT | 1 hora 🔸 |
| Refresh Token JWT | 30 dias 🔸 |
| Token verificacion email | 24 horas 🔸 |
| Token reset contrasena | 1 hora 🔸 |
| Sesion de autenticacion | 30 dias 🔸 |

### RN-04: Slots de Disponibilidad
- Duracion fija: 30 minutos 🔸
- Max por dia: 8 slots (4 horas) 🔸
- Incrementos: solo :00 y :30

### RN-05: Sesiones de Tutoria
- Duraciones permitidas: 1h, 1.5h, 2h 🔸
- Cancelacion tardiva: se registra si es dentro de 24h 🔸

### RN-06: Modificaciones de Sesion
- Solo para sesiones SCHEDULED
- Propuesta expira en 24 horas 🔸
- Requiere aceptacion de la contraparte (cambios importantes)
- Cambios menores (titulo, descripcion, location, virtualLink) no requieren aprobacion

### RN-07: Horas Semanales del Tutor
- Minimo: 1 hora 🔸
- Maximo: 40 horas 🔸
- Default: 8 horas 🔸

### RN-08: Umbrales de Alerta de Horas
- 80% -> Advertencia 🔸
- 95% -> Urgente 🔸
- 100% -> Critico 🔸

### RN-09: Paginacion
- Default: 10 items 🔸
- Maximo: 50 items 🔸
- Audit logs default: 20 items 🔸

### RN-10: Limpieza Automatica
- Cron diario a medianoche
- Elimina sesiones de auth expiradas hace mas de 7 dias 🔸

### RN-11: Recordatorios de Sesion
- 24 horas antes 🔸
- 2 horas antes 🔸

### RN-12: Confirmacion del Tutor
- El tutor tiene 24 horas para confirmar una sesion 🔸

---

## 4. Modulos Pendientes de Implementacion

### Evaluacion de Sesiones (esqueleto)
- Entidades: Question, Answer
- Controllers vacios: EvaluationController, TutorRatingsController
- Endpoints planificados:
  - POST /session-execution/sessions/{sessionId}/evaluation
  - GET /session-execution/sessions/{sessionId}/evaluation
  - GET /session-execution/tutors/{tutorId}/evaluations
  - GET /session-execution/tutors/{tutorId}/stats

### Notificaciones (parcial)
- Servicio completo (emails via Resend + Handlebars templates)
- Controller vacio (no hay endpoints HTTP para notificaciones)

---

## 5. Problemas Conocidos

| ID | Severidad | Descripcion |
|----|-----------|-------------|
| P-01 | CRITICO | ValidationPipe no habilitado en main.ts - Los DTOs con class-validator son decorativos |
| P-02 | CRITICO | Enums UserRole y UserStatus duplicados con valores incompatibles entre user.entity.ts y auth/enums/ |
| P-03 | CRITICO | README.md tiene conflictos de merge sin resolver |
| P-04 | WARNING | Valores hardcodeados en logica de negocio (tiempos, limites, umbrales) |
| P-05 | INFO | Modulo EvaluationModule es solo un esqueleto |
