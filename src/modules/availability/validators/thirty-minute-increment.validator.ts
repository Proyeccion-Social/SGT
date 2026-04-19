import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validador que verifica que la hora esté en incrementos de 30 minutos (00 o 30).
 * Ejemplo: 14:00 ✅, 14:30 ✅, 14:15 ❌
 */
@ValidatorConstraint({ name: 'isThirtyMinuteIncrement', async: false })
export class IsThirtyMinuteIncrementConstraint implements ValidatorConstraintInterface {
  validate(time: string): boolean {
    if (!time || typeof time !== 'string') {
      return false;
    }

    // Validar formato HH:mm
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    const match = time.match(timeRegex);

    if (!match) {
      return false;
    }

    const minutes = parseInt(match[2], 10);

    // Los minutos deben ser 00 o 30
    return minutes === 0 || minutes === 30;
  }

  defaultMessage(): string {
    return 'La hora debe estar en incrementos de 30 minutos (00 o 30)';
  }
}

/**
 * Decorador para validar incrementos de 30 minutos.
 * @param validationOptions Opciones de validación
 */
export function IsThirtyMinuteIncrement(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsThirtyMinuteIncrementConstraint,
    });
  };
}
