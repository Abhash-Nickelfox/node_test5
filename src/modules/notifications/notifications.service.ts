import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '@modules/notifications/entities/notification.entity';
import { SendNotificationDto } from '@modules/notifications/dto/send-notification.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationEvent } from '@modules/notifications/events/notification.event';
import { IPaginationOptions, Pagination, paginate } from 'nestjs-typeorm-paginate';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    private eventEmitter: EventEmitter2,
  ) {}

  async sendNotification(userId: string, sendNotificationDto: SendNotificationDto): Promise<Notification> {
    const notification = this.notificationsRepository.create({
      userId,
      title: sendNotificationDto.title,
      message: sendNotificationDto.message,
      isRead: false,
    });

    const savedNotification = await this.notificationsRepository.save(notification);

    this.eventEmitter.emit(
      'notification.send',
      new NotificationEvent({
        notification: savedNotification,
        sendEmail: sendNotificationDto.sendEmail ?? false, // Rule 44
      }),
    );

    return savedNotification;
  }

  async getNotifications(userId: string, options: IPaginationOptions): Promise<Pagination<Notification>> {
    const queryBuilder = this.notificationsRepository.createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC');

    return paginate<Notification>(queryBuilder, options);
  }

  async markAsRead(id: string, userId: string): Promise<Notification | null> {
    let notification: Notification | null = null; // Rule 33
    notification = await this.notificationsRepository.findOne({ where: { id, userId } });

    if (!notification) {
      return null;
    }

    notification.isRead = true;
    return this.notificationsRepository.save(notification);
  }
}
