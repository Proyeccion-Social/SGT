/**
 * Política de contraseñas del sistema.
 *
 * Requisitos:
 *  - Mínimo 8 caracteres
 *  - Al menos una letra minúscula
 *  - Al menos una letra mayúscula
 *  - Al menos un dígito
 *  - Al menos un carácter especial del conjunto permitido
 *
 * Caracteres especiales permitidos:
 *  @ $ ! % * ? & # . , ; : - _ + = ( ) [ ] { } / \ | ^ ~ ` ' "
 */
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#.,;:\-_+=()[\]{}/\\|^~`'"<>])[A-Za-z\d@$!%*?&#.,;:\-_+=()[\]{}/\\|^~`'"<>]{8,}$/;

export const PASSWORD_POLICY_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres e incluir mayúsculas, minúsculas, números y caracteres especiales';
