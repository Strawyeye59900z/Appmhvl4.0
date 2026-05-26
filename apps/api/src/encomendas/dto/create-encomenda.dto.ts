import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateEncomendaDto {
  @IsString()
  moradorId: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descricao?: string;
}
