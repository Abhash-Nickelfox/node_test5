import { Module } from '@nestjs/common';
import { UploadsService } from '@modules/uploads/uploads.service';
import { UploadsController } from '@modules/uploads/uploads.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileUpload } from '@modules/uploads/entities/file-upload.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FileUpload])],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
