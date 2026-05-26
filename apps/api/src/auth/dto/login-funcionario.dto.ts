import { IsString, MinLength } from 'class-validator';

export class LoginFuncionarioDto {
  @IsString()
  funcionarioId: string;

  @IsString()
  @MinLength(4)
  password: string;
}
