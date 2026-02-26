import { Controller, Post, UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator, Req, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Request as ExpressRequest } from 'express';
import { UploadsService } from '@modules/uploads/uploads.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { User } from '@modules/users/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  constructor(
    private readonly uploadsService: UploadsService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req: ExpressRequest, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
        const uploadDest = process.env.UPLOAD_DEST ?? './uploads'; // Rule 22: Use process.env or static
        cb(null, uploadDest);
      },
      filename: (req: ExpressRequest, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${file.fieldname}-${uniqueSuffix}-${file.originalname}`);
      },
    }),
  }))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: (process.env.MAX_FILE_SIZE_MB ? parseInt(process.env.MAX_FILE_SIZE_MB, 10) : 5) * 1024 * 1024,
          }),
          new FileTypeValidator({
            fileType: process.env.ALLOWED_FILE_TYPES || /(image\/(jpeg|png)|application\/pdf)/,
          }),
        ],
      }),
    ) file: Express.Multer.File,
    @Req() req: ExpressRequest, // Rule 32: Import @Req()
  ) {
    const user = req.user as User;
    if (!user || !user.id) {
      throw new BadRequestException('User not authenticated for file upload.');
    }

    try {
      const fileRecord = await this.uploadsService.createFileRecord(
        file.filename,
        file.mimetype,
        file.size,
        file.path,
        user.id,
      );
      return {
        message: 'File uploaded successfully',
        file: {
          id: fileRecord.id,
          filename: fileRecord.filename,
          mimetype: fileRecord.mimetype,
          size: fileRecord.size,
          path: fileRecord.path,
          userId: fileRecord.userId,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to save file record: ${(error as Error).message}`, (error as Error).stack);
      throw new BadRequestException('Failed to process file upload.');
    }
  }
}
