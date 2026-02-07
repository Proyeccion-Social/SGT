import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorCode } from "../enums";
import { BusinessExceptionResponse } from "../interfaces";

export class BusinessException extends HttpException {
    constructor(
        private readonly errorCode: ErrorCode,
        private readonly errorMessage: string,
        private readonly errorDescription: string,
        private readonly statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
        private readonly validationErrors?: Array<{ field: string; message: string }>,
    ) {
        super({
            code: errorCode,
            message: errorMessage,
            description: errorDescription,
            errors: validationErrors,
        }, statusCode,);
    }

    getErrorCode(): ErrorCode {
        return this.errorCode;
    }

    getValidationErrors() {
        return this.validationErrors;
    }
}
