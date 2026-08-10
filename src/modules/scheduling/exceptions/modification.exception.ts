import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '../../auth/exceptions/business.exception';
import { ErrorCode } from '../../auth/enums';

export class ModificationException extends BusinessException {
  constructor(
    errorCode: ErrorCode,
    message: string,
    description: string,
    statusCode: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
  ) {
    super(errorCode, message, description, statusCode);
  }

  static sessionNotScheduled(): ModificationException {
    return new ModificationException(
      ErrorCode.SCHEDULING_01,
      'La sesión no puede ser modificada',
      'Solo puedes proponer modificaciones en sesiones con estado SCHEDULED.',
    );
  }

  static tooCloseToSession(
    daysUntil: number,
    required: number,
  ): ModificationException {
    return new ModificationException(
      ErrorCode.SCHEDULING_02,
      'Modificación demasiado próxima a la sesión',
      `Solo puedes proponer modificaciones con más de ${required} días de anticipación. Esta sesión es en ${daysUntil} día(s).`,
    );
  }

  static noChangesProposed(): ModificationException {
    return new ModificationException(
      ErrorCode.SCHEDULING_03,
      'No se propuso ningún cambio',
      'Debes incluir al menos un campo modificado: fecha, disponibilidad, modalidad o duración.',
    );
  }

  static modalityNotSupportedBySlot(
    requested: string,
    supported: string,
  ): ModificationException {
    return new ModificationException(
      ErrorCode.SCHEDULING_04,
      'Modalidad no compatible con el horario',
      `El slot seleccionado solo soporta modalidad ${supported}. Solicitaste ${requested}.`,
    );
  }

  static slotCannotCoverDuration(
    durationHours: number,
    available: number,
  ): ModificationException {
    return new ModificationException(
      ErrorCode.SCHEDULING_05,
      'Duración no disponible en el horario',
      `El tutor no tiene franjas suficientes para cubrir ${durationHours}h. Solo tiene ${available} franja(s) disponible(s).`,
    );
  }
}
