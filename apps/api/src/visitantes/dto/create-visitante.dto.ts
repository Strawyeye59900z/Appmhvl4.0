import { IsString, IsNotEmpty, IsEnum, IsInt, Min, Max } from 'class-validator';

export enum TipoVisitanteDto {
  PERSONAL = 'PERSONAL',
  FUNCIONARIO_TEMP = 'FUNCIONARIO_TEMP',
}

export class CreateVisitanteDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsEnum(TipoVisitanteDto)
  tipo: TipoVisitanteDto;

  @IsInt()
  @Min(1)
  @Max(12)
  meses: number;
}
