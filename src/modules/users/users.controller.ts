import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, NotFoundException } from '@nestjs/common';
import { UsersService } from '@modules/users/users.service';
import { CreateUserDto } from '@modules/users/dto/create-user.dto';
import { UpdateUserDto } from '@modules/users/dto/update-user.dto';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { RoleEnum } from '@common/enums/role.enum';
import { Public } from '@common/decorators/public.decorator';
import { User } from '@modules/users/entities/user.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(RoleEnum.ADMIN)
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(RoleEnum.ADMIN, RoleEnum.MANAGER)
  async findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(RoleEnum.ADMIN, RoleEnum.MANAGER, RoleEnum.VIEWER)
  async findOne(@Param('id') id: string): Promise<User> {
    const user = await this.usersService.findOne(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    return user;
  }

  @Patch(':id')
  @Roles(RoleEnum.ADMIN, RoleEnum.MANAGER)
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto): Promise<User> {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(RoleEnum.ADMIN)
  async remove(@Param('id') id: string): Promise<void> {
    await this.usersService.remove(id);
  }
}
