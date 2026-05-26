import { IsString, MinLength } from 'class-validator';

export class SetupSenhaFuncionarioDto {
  @IsString()
  funcionarioId: string;

  @IsString()
  @MinLength(6)
  novaSenha: string;
}

export class SetupSenhaMoradorDto {
  @IsString()
  apartamentoId: string;

  @IsString()
  @MinLength(6)
  novaSenha: string;
}
