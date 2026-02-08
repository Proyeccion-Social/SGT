import { 
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Query,
    ValidationPipe,
    UsePipes,
    UseFilters,
 } from '@nestjs/common';
 import { AuthService } from '../services/auth.service';
 import { RegisterStudentDto } from '../dto';
 import { RegisterResponse } from '../interfaces';
 import { BusinessExceptionFilter } from '../filters/business-exception.filter';

@Controller('auth')
@UseFilters(BusinessExceptionFilter)
export class AuthController {
    constructor(private readonly authService: AuthService){}

    @Post('register')
    @HttpCode(HttpStatus.OK)
    @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    async register(
        @Body() registerDto: RegisterStudentDto
    ): Promise<RegisterResponse> {
        return this.authService.registerStudent(registerDto);
    }

    @Post('confirm-email')
    @HttpCode(HttpStatus.OK)
    async confirmEmail(
        @Query('token') token: string
    ): Promise<{ message: string }> {
        return this.authService.confirmEmail(token);
    }
}
