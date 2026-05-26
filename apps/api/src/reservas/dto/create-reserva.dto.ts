import { IsString, IsDateString, IsOptional, Matches } from 'class-validator';

export class CreateReservaDto {
  @IsString()
  espacoReservaId: string;

  @IsDateString()
  data: string; // ISO date "YYYY-MM-DD"

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):00$/, { message: 'horaInicio deve ser HH:00 (hora cheia)' })
  horaInicio?: string; // "HH:00" — obrigatório para POR_HORA

  @IsOptional()
  @IsString()
  observacao?: string;
}
