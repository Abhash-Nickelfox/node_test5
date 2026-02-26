import { IsEmail, IsString, MinLength, IsOptional, IsArray, IsEnum } from 'class-validator';
import { RoleEnum } from '@common/enums/role.enum';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(RoleEnum, { each: true })
  roles?: RoleEnum[];
}
