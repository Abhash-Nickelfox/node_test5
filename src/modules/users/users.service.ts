import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import { CreateUserDto } from '@modules/users/dto/create-user.dto';
import { UpdateUserDto } from '@modules/users/dto/update-user.dto';
import { Role } from '@modules/users/entities/role.entity';
import { RoleEnum } from '@common/enums/role.enum';
import * as bcrypt from 'bcryptjs';
import { Logger } from '@nestjs/common';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { email, password, roles: roleEnums, ...rest } = createUserDto;

    const passwordHash = await bcrypt.hash(password, 10);

    const user = this.usersRepository.create({
      email,
      passwordHash,
      isActive: true,
      ...rest,
    });

    if (roleEnums && roleEnums.length > 0) {
      const roles = await this.rolesRepository.find({
        where: { name: In(roleEnums) },
      });
      if (roles.length !== roleEnums.length) {
        this.logger.warn(`Some roles not found for user creation: ${roleEnums.filter((re: RoleEnum) => !roles.some((r: Role) => r.name === re)).join(', ')}`);
      }
      user.roles = roles;
    } else {
      // Assign default 'VIEWER' role if no roles are provided
      const defaultRole = await this.rolesRepository.findOne({ where: { name: RoleEnum.VIEWER as any } });
      if (defaultRole) {
        user.roles = [defaultRole];
      } else {
        this.logger.error('Default VIEWER role not found during user creation.');
      }
    }

    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({ relations: ['roles'] });
  }

  async findOne(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id }, relations: ['roles'] });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email }, relations: ['roles'] });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    let user = await this.usersRepository.findOne({ where: { id }, relations: ['roles'] });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    if (updateUserDto.email) user.email = updateUserDto.email;
    if (updateUserDto.firstName) user.firstName = updateUserDto.firstName;
    if (updateUserDto.lastName) user.lastName = updateUserDto.lastName;
    if (updateUserDto.isActive !== undefined) user.isActive = updateUserDto.isActive;

    if (updateUserDto.password) {
      user.passwordHash = await bcrypt.hash(updateUserDto.password, 10);
    }

    if (updateUserDto.roles && updateUserDto.roles.length > 0) {
      const roles = await this.rolesRepository.find({
        where: { name: In(updateUserDto.roles) },
      });
      if (roles.length !== updateUserDto.roles.length) {
        this.logger.warn(`Some roles not found for user update: ${updateUserDto.roles.filter((re: RoleEnum) => !roles.some((r: Role) => r.name === re)).join(', ')}`);
      }
      user.roles = roles;
    } else if (updateUserDto.roles && updateUserDto.roles.length === 0) {
      user.roles = []; // Clear roles if an empty array is explicitly passed
    }

    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
  }
}
