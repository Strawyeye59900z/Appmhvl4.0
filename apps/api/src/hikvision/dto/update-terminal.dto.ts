import { IsString, IsInt, IsOptional, IsBoolean, Min, Max } from 'class-validator';

export class UpdateTerminalDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  host?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(65535)
  porta?: number;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsBoolean()
  @IsOptional()
  ativo?: boolean;
}
