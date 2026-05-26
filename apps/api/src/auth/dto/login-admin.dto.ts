import { IsString, MinLength } from 'class-validator';

export class LoginAdminDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(4)
  password: string;
}
