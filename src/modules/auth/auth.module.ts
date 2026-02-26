import { Module } from '@nestjs/common';
import { AuthService } from '@modules/auth/auth.service';
import { AuthController } from '@modules/auth/auth.controller';
import { UsersModule } from '@modules/users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStrategy } from '@modules/auth/strategies/local.strategy';
import { JwtStrategy } from '@modules/auth/strategies/jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from '@modules/auth/entities/refresh-token.entity';
import { MailModule } from '@modules/mail/mail.module';
import { User } from '@modules/users/entities/user.entity';
import { Role } from '@modules/users/entities/role.entity';

@Module({
  imports: [
    UsersModule, // Provides UsersService and TypeOrmModule.forFeature([User, Role])
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRATION') },
      }),
    }),
    TypeOrmModule.forFeature([RefreshToken, User, Role]), // Ensure User and Role are available for AuthService
    MailModule, // Critical: MailModule must be imported if AuthService injects MailService
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
