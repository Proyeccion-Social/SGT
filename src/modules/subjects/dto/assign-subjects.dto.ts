import { IsArray, ArrayMinSize, ArrayMaxSize, IsUUID, } from "class-validator";

export class AssignSubjectsDto {
    @IsArray()
    @ArrayMinSize(1, { message: 'Debe asignar al menos una materia' })
    @ArrayMaxSize(3, { message: 'No puede asignar más de 3 materias' })
    @IsUUID('all', { each: true })
    subjects_ids: string[];
}