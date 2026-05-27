import { IsString, IsNotEmpty, IsOptional, MaxLength, Matches } from 'class-validator';

export class CreateMoradorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  apartamentoId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, { message: 'CPF inválido' })
  cpf?: string;

  @IsString()
  @IsNotEmpty({ message: 'WhatsApp é obrigatório' })
  @Matches(/^\+55\d{10,11}$/, { message: 'WhatsApp inválido. Use o formato +55XXXXXXXXXXX' })
  whatsapp: string;
}
