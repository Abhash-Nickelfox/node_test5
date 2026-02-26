import { IsEmail, IsString, MinLength, IsOptional, IsBoolean, IsArray, IsEnum } from 'class-validator';
import { RoleEnum } from '@common/enums/role.enum';

export class CreateUserDto {
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
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsEnum(RoleEnum, { each: true })
  roles?: RoleEnum[];
}
