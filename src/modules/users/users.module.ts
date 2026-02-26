import { Module } from '@nestjs/common';
import { UsersService } from '@modules/users/users.service';
import { UsersController } from '@modules/users/users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@modules/users/entities/user.entity';
import { Role } from '@modules/users/entities/role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule], // Export TypeOrmModule to make repositories available to other modules
})
export class UsersModule {}
