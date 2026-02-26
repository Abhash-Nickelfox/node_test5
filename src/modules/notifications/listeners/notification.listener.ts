import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationEvent } from '@modules/notifications/events/notification.event';
import { MailService } from '@modules/mail/mail.service';
import { UsersService } from '@modules/users/users.service';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
  ) {}

  @OnEvent('notification.send')
  async handleNotificationSendEvent(event: NotificationEvent) {
    const { notification, sendEmail } = event.payload;
    this.logger.log(`Notification event received for user ${notification.userId}: ${notification.title}`);

    if (sendEmail) {
      const user = await this.usersService.findOne(notification.userId);
      if (user) {
        await this.mailService.sendNotification(user.email, notification.title, notification.message);
      } else {
        this.logger.warn(`User with ID ${notification.userId} not found for email notification.`);
      }
    }
  }
}
