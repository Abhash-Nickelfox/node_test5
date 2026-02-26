import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendWelcome(to: string, name: string): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: to,
        subject: 'Welcome to My App!',
        template: 'welcome',
        context: {
          name: name,
          appName: this.configService.get<string>('APP_NAME') || 'My App',
        },
      });
      this.logger.log(`Welcome email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${to}: ${(error as Error).message}`);
    }
  }

  async sendPasswordReset(to: string, name: string, resetLink: string): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: to,
        subject: 'Password Reset Request',
        template: 'password-reset',
        context: {
          name: name,
          resetLink: resetLink,
          appName: this.configService.get<string>('APP_NAME') || 'My App',
        },
      });
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}: ${(error as Error).message}`);
    }
  }

  async sendNotification(to: string, title: string, message: string): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: to,
        subject: title,
        html: `<p>Dear User,</p><p>${message}</p><p>Regards,<br>${this.configService.get<string>('APP_NAME') || 'My App'} Team</p>`,
      });
      this.logger.log(`Notification email sent to ${to} with title: ${title}`);
    } catch (error) {
      this.logger.error(`Failed to send notification email to ${to}: ${(error as Error).message}`);
    }
  }
}
