export enum ErrorCode {
  //VALIDATION
  VALIDATION_01 = 'VALIDATION_01', //Datos de entrada inválidos
  VALIDATION_02 = 'VALIDATION_02', //Token inválido

  //RESOURCE
  RESOURCE_01 = 'RESOURCE_01', //Correo ya registrado
  RESOURCE_02 = 'RESOURCE_02', //Recurso no encontrado
  RESOURCE_03 = 'RESOURCE_03', //Sesión no encontrada

  //AUTH
  AUTH_01 = 'AUTH_01', //Token inválido o expirado
  AUTH_02 = 'AUTH_02', //Token ya utilizado
  AUTH_03 = 'AUTH_03', //Credenciales inválidas
  AUTH_04 = 'AUTH_04', //Cuenta inactiva
  AUTH_05 = 'AUTH_05', //Token no proporcionado
  AUTH_06 = 'AUTH_06', //Contraseña actual incorrecta

  //INTERNAL
  INTERNAL_01 = 'INTERNAL_01', //Error interno del servidor

  //PERMISSION
  PERMISSION_01 = 'PERMISSION_01', //Acceso no autorizado

  //SCHEDULING
  SCHEDULING_01 = 'SCHEDULING_01', //Sesión no está en estado SCHEDULED
  SCHEDULING_02 = 'SCHEDULING_02', //Modificación demasiado próxima a la sesión
  SCHEDULING_03 = 'SCHEDULING_03', //No se propuso ningún cambio
  SCHEDULING_04 = 'SCHEDULING_04', //Modalidad no compatible con el slot
  SCHEDULING_05 = 'SCHEDULING_05', //Duración no disponible en el horario
}
