# Configuración de Base de Datos - SGT

Este documento describe cómo configurar la base de datos para el Sistema de Gestión de Tutorías.

## 📋 Prerequisitos

- PostgreSQL 12 o superior instalado
- Node.js 18 o superior
- npm o yarn

## 🚀 Configuración Inicial

### 1. Crear Base de Datos Local

```sql
CREATE DATABASE sgt_db;
```

### 2. Configurar Variables de Entorno

Copia el archivo `.env.example` a `.env`:

Edita el archivo `.env` con tus credenciales:

```env
# Configuración de Base de Datos Local
LOCAL_DB_HOST=localhost
LOCAL_DB_PORT=5432
LOCAL_DB_USER=postgres
LOCAL_DB_PASSWORD=tu_password_aqui
LOCAL_DB_NAME=sgt_db

# Configuración de Base de Datos Neon (Producción)
NEON_DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Configuración de la Aplicación
PORT=3000
NODE_ENV=development
```

### 3. Instalar Dependencias

```bash
npm install
```

### 4. Ejecutar la Aplicación


## 🗂️ Estructura de Entidades

El proyecto incluye las siguientes entidades TypeORM:

### **Usuarios y Perfiles**
- `User` - Usuarios del sistema (estudiantes, tutores, administradores)
- `Student` - Perfil de estudiante
- `Tutor` - Perfil de tutor

### **Materias**
- `Subject` - Materias/asignaturas
- `TutorImpartSubject` - Relación tutores-materias
- `StudentInterestedSubject` - Relación estudiantes-materias

### **Disponibilidad**
- `Availability` - Horarios disponibles
- `TutorHaveAvailability` - Disponibilidad de tutores

### **Sesiones**
- `Session` - Sesiones de tutoría
- `ScheduledSession` - Sesiones programadas
- `StudentParticipateSession` - Participación de estudiantes

### **Evaluación**
- `Question` - Preguntas de evaluación
- `Answer` - Respuestas de estudiantes

## 🔧 Configuración de TypeORM

El proyecto está configurado con **dos conexiones** de base de datos:

1. **`local`** - Base de datos PostgreSQL local para desarrollo
   - Sincronización automática habilitada en modo desarrollo
   - Logging habilitado

2. **`neon`** - Base de datos Neon para producción
   - Sincronización deshabilitada
   - SSL habilitado

## 📝 Notas Importantes

- **Sincronización Automática**: En desarrollo (`NODE_ENV=development`), TypeORM sincronizará automáticamente el esquema de la base de datos con las entidades. **No usar esto en producción**.

- **Migraciones**: Para producción, se debe crear y ejecutar migraciones manualmente.

## 🔍 Verificar Conexión

Para verificar que la base de datos está correctamente configurada:

1. Ejecuta la aplicación en modo desarrollo
2. Revisa los logs - deberías ver:
   - Conexión exitosa a la base de datos
   - Listado de entidades cargadas


## �📚 Recursos Adicionales

- [TypeORM Documentation](https://typeorm.io/)
- [NestJS TypeORM Integration](https://docs.nestjs.com/techniques/database)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
