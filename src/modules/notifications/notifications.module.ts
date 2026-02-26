import { Module } from '@nestjs/common';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { NotificationsController } from '@modules/notifications/notifications.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '@modules/notifications/entities/notification.entity';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationListener } from '@modules/notifications/listeners/notification.listener';
import { MailModule } from '@modules/mail/mail.module';
import { UsersModule } from '@modules/users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    EventEmitterModule, // Already imported globally in AppModule, but good practice to list if used locally
    MailModule,
    UsersModule, // To get access to UsersService for fetching user emails
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
