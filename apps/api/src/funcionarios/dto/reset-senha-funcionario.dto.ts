import { IsString, MinLength, MaxLength } from 'class-validator';

export class ResetSenhaFuncionarioDto {
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  senha: string;
}
