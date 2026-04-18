import { registerDecorator, ValidationOptions, ValidationArguments } from "class-validator";

export function IsInstitutionalEmail(validationOptions?: ValidationOptions){
    return function(object: Object, propertyName: string){
        registerDecorator({
            name: "isInstitutionalEmail",
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: {
                validate(value: any, args: ValidationArguments){
                    if(typeof value !== "string") return false;

                    return value.endsWith("@udistrital.edu.co");
                },
                defaultMessage(args: ValidationArguments){
                    return `Correo institucional inválido`;
                },
            },
        });
    };
}