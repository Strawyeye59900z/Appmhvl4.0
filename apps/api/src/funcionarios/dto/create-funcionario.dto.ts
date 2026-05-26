import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateFuncionarioDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;
}
