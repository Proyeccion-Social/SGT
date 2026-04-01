import{
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { BusinessException } from '../exceptions/business.exception';
import { BusinessExceptionResponse } from '../interfaces';

@Catch(BusinessException)
export class BusinessExceptionFilter implements ExceptionFilter {
    catch(exception: BusinessException, host: ArgumentsHost){
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const status = exception.getStatus();
        const exceptionResponse = exception.getResponse() as BusinessExceptionResponse;

        response.status(status).json({
            code: exceptionResponse.code,
            message: exceptionResponse.message,
            description: exceptionResponse.description,
            ...(exceptionResponse.errors && { errors: exceptionResponse.errors }),
            timestamp: new Date().toISOString(),
        });
    }
}