import { IsString, MinLength } from 'class-validator';

export class LoginMoradorDto {
  @IsString()
  numeroApartamento: string;

  @IsString()
  @MinLength(4)
  password: string;
}
