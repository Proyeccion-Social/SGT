import{ 
    IsEmail,
    IsString,
    IsNotEmpty,
    MinLength,
    MaxLength,
    Matches,
} from "class-validator";
import { IsInstitutionalEmail } from "../decorators/is-institutional-email.decorator";
import { Match } from "../decorators/match.decorator";

export class RegisterStudentDto{
    @IsNotEmpty({ message: "Nombre completo del usuario es requerido"})
    @IsString({ message: "El nombre completo debe ser una cadena de caracteres"})
    fullName: string;

    @IsNotEmpty({ message: "Correo institucional del usuario es requerido"})
    @IsEmail({}, { message: "El correo electrónico debe tener un formato válido"})
    @IsInstitutionalEmail({ message: "Correo institucional inválido"})
    email: string;

    @IsNotEmpty({ message: "Contraseña del usuario es requerida"})
    @IsString({ message: "La contraseña debe ser una cadena de caracteres"})
    @MinLength(8, { message: "La contraseña debe tener al menos 8 caracteres"})
    @MaxLength(128, { message: "La contraseña debe tener menos de 128 caracteres"})
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$/,{ message: "La contraseña debe tener al menos una letra mayúscula, una letra minúscula, un número y un carácter especial"})
    password: string;

    @IsNotEmpty({ message: "Confirmación de contraseña es requerida"})
    @Match("password", { message: "Las contraseñas no coinciden"})
    confirmPassword: string;
}