import { IsEnum, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SlotAction } from '../enums/slot-action.enum';
import { CreateSlotDto } from './create-slot.dto';
import { UpdateSlotDto } from './update-slot.dto';
import { DeleteSlotDto } from './delete-slot.dto';

export class ManageSlotDto {
  @IsNotEmpty({ message: 'La acción es requerida' })
  @IsEnum(SlotAction, { message: 'Acción debe ser CREATE, UPDATE o DELETE' })
  action: SlotAction;

  @ValidateNested()
  @Type(() => Object)
  data?: CreateSlotDto | UpdateSlotDto | DeleteSlotDto;
}
