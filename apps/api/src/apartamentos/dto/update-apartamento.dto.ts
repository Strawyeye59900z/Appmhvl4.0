import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateApartamentoDto } from './create-apartamento.dto';

export class UpdateApartamentoDto extends PartialType(CreateApartamentoDto) {
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
