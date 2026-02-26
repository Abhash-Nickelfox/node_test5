import { Controller, Post, Body, Get, Param, Patch, UseGuards, Req, Query, DefaultValuePipe, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { SendNotificationDto } from '@modules/notifications/dto/send-notification.dto';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { User } from '@modules/users/entities/user.entity';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { RoleEnum } from '@common/enums/role.enum';
import { Request as ExpressRequest } from 'express';
import { Notification } from '@modules/notifications/entities/notification.entity';
import { Pagination } from 'nestjs-typeorm-paginate';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send')
  @Roles(RoleEnum.ADMIN, RoleEnum.MANAGER)
  async sendNotification(@Req() req: ExpressRequest, @Body() sendNotificationDto: SendNotificationDto): Promise<Notification> {
    const user = req.user as User;
    // For simplicity, this endpoint sends a notification to the requesting user.
    // In a real app, you might have a 'recipientId' in the DTO.
    return this.notificationsService.sendNotification(user.id, sendNotificationDto);
  }

  @Get()
  async getNotifications(
    @Req() req: ExpressRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ): Promise<Pagination<Notification>> {
    const user = req.user as User;
    limit = limit > 100 ? 100 : limit; // Max limit
    return this.notificationsService.getNotifications(user.id, { page, limit });
  }

  @Patch(':id/read')
  async markAsRead(@Req() req: ExpressRequest, @Param('id') id: string): Promise<Notification> {
    const user = req.user as User;
    const notification = await this.notificationsService.markAsRead(id, user.id);
    if (!notification) {
      throw new NotFoundException(`Notification with ID "${id}" not found or does not belong to user.`);
    }
    return notification;
  }
}
