import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateApartamentoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  numero: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  bloco?: string;
}
