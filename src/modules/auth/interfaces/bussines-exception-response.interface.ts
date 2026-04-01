import { ErrorCode } from "../enums";

export interface BusinessExceptionResponse{
    code: ErrorCode;
    message: string;
    description: string;
    errors?: Array<{ field: string; message: string }>;
}