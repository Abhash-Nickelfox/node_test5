import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileUpload } from '@modules/uploads/entities/file-upload.entity';

@Injectable()
export class UploadsService {
  constructor(
    @InjectRepository(FileUpload)
    private readonly fileUploadRepository: Repository<FileUpload>,
  ) {}

  async createFileRecord(filename: string, mimetype: string, size: number, path: string, userId?: string): Promise<FileUpload> {
    const fileRecord = this.fileUploadRepository.create({
      filename,
      mimetype,
      size,
      path,
      userId: userId ?? undefined, // Rule 18: use undefined for optional fields
    });
    return this.fileUploadRepository.save(fileRecord);
  }

  async findFileRecord(id: string): Promise<FileUpload | null> {
    return this.fileUploadRepository.findOne({ where: { id } });
  }
}
