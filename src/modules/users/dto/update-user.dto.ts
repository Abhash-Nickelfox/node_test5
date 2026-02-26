import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from '@modules/users/dto/create-user.dto';
import { IsString, MinLength, IsOptional, IsBoolean, IsArray, IsEnum } from 'class-validator';
import { RoleEnum } from '@common/enums/role.enum';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsEnum(RoleEnum, { each: true })
  roles?: RoleEnum[];
}
