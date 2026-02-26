import { Module } from '@nestjs/common';
import { AppController } from '@app/app.controller';
import { AppService } from '@app/app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from '@modules/health/health.module';
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import configuration from '@app/config/configuration';
import { MailModule } from '@modules/mail/mail.module';
import { UploadsModule } from '@modules/uploads/uploads.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from '@common/logger/winston.config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { User } from '@modules/users/entities/user.entity';
import { Role } from '@modules/users/entities/role.entity';
import { RefreshToken } from '@modules/auth/entities/refresh-token.entity';
import { FileUpload } from '@modules/uploads/entities/file-upload.entity';
import { Notification } from '@modules/notifications/entities/notification.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'better-sqlite3',
        database: configService.get<string>('DATABASE_URL') || './data/my_app.db',
        entities: [User, Role, RefreshToken, FileUpload, Notification],
        synchronize: false, // Never use synchronize in production
        autoLoadEntities: true,
        logging: configService.get<string>('NODE_ENV') === 'development' ? ['query', 'error'] : ['error'],
      }),
    }),
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => winstonConfig(configService),
    }),
    EventEmitterModule.forRoot(),
    HealthModule,
    AuthModule,
    UsersModule,
    MailModule,
    UploadsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
