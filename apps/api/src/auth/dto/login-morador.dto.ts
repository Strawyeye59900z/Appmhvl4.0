import { IsString, MinLength, IsOptional } from 'class-validator';

export class LoginMoradorDto {
  @IsOptional()
  @IsString()
  numeroApartamento?: string;

  @IsOptional()
  @IsString()
  apartamentoId?: string;

  @IsString()
  @MinLength(4)
  password: string;
}
