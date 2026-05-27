import { IsString, IsDateString, IsOptional, IsInt, Min, Max, Matches } from 'class-validator';

export class CreateReservaDto {
  @IsString()
  espacoReservaId: string;

  @IsOptional()
  @IsString()
  apartamentoId?: string; // usado pelo ADMIN para criar em nome de um morador

  @IsDateString()
  data: string; // ISO date "YYYY-MM-DD"

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):00$/, { message: 'horaInicio deve ser HH:00 (hora cheia)' })
  horaInicio?: string; // "HH:00" — obrigatório para POR_HORA

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  duracao?: number; // quantidade de horas (1-3), default 1

  @IsOptional()
  @IsString()
  observacao?: string;
}
