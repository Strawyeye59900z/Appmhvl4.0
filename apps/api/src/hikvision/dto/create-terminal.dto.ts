import { IsString, IsNotEmpty, IsInt, IsOptional, Min, Max } from 'class-validator';

export class CreateTerminalDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsString()
  @IsNotEmpty()
  host: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(65535)
  porta?: number;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
