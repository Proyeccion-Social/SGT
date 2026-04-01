// src/modules/in-app-notifications/enums/notification-type.enum.ts
 
export enum NotificationType {
  // ── Cuenta ───────────────────────────────────────────────────────────────
  ACCOUNT_CREATED           = 'ACCOUNT_CREATED',
  PROFILE_COMPLETED         = 'PROFILE_COMPLETED',
  PASSWORD_CHANGED          = 'PASSWORD_CHANGED',
 
  // ── Agendamiento ─────────────────────────────────────────────────────────
  SESSION_REQUEST_RECEIVED  = 'SESSION_REQUEST_RECEIVED',   // tutor: nueva solicitud
  SESSION_REQUEST_SENT      = 'SESSION_REQUEST_SENT',       // estudiante: solicitud enviada
  SESSION_CONFIRMED         = 'SESSION_CONFIRMED',          // ambos: sesión confirmada
  SESSION_REJECTED          = 'SESSION_REJECTED',           // estudiante: solicitud rechazada
  SESSION_CANCELLED         = 'SESSION_CANCELLED',          // ambos: sesión cancelada
  SESSION_DETAILS_UPDATED   = 'SESSION_DETAILS_UPDATED',    // ambos: detalles editados
  SESSION_REMINDER          = 'SESSION_REMINDER',           // ambos: recordatorio
 
  // ── Modificaciones ───────────────────────────────────────────────────────
  MODIFICATION_REQUESTED    = 'MODIFICATION_REQUESTED',     // contraparte: propuesta recibida
  MODIFICATION_ACCEPTED     = 'MODIFICATION_ACCEPTED',      // solicitante: aceptada
  MODIFICATION_REJECTED     = 'MODIFICATION_REJECTED',      // solicitante: rechazada
 
  // ── Post-sesión ──────────────────────────────────────────────────────────
  EVALUATION_PENDING        = 'EVALUATION_PENDING',         // estudiante: calificar sesión
 
  // ── Disponibilidad ───────────────────────────────────────────────────────
  AVAILABILITY_CHANGED      = 'AVAILABILITY_CHANGED',       // estudiante: tutor cambió franja
  HOUR_LIMIT_ALERT          = 'HOUR_LIMIT_ALERT',           // tutor: cerca del límite semanal
 
  // ── Colaborativas ────────────────────────────────────────────────────────
  COLLABORATIVE_SESSION_OPEN = 'COLLABORATIVE_SESSION_OPEN', // interesados: nueva sesión abierta
}