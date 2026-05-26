import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateFuncionarioDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nome?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
