import { IsString, MinLength } from 'class-validator';

export class LoginMoradorDto {
  @IsString()
  apartamentoId: string;

  @IsString()
  @MinLength(4)
  password: string;
}
