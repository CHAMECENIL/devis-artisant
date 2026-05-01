import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentType } from './entities/document.entity';
import { CreateDocumentDto, RequestUploadUrlDto } from './dto/document.dto';
import { StorageService } from '../storage/storage.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GedService {
  constructor(
    @InjectRepository(Document) private documentRepo: Repository<Document>,
    private storageService: StorageService,
  ) {}

  async requestUploadUrl(dto: RequestUploadUrlDto, tenantId: string, userId: string) {
    const ext = dto.filename.split('.').pop();
    const key = this.storageService.buildKey(tenantId, 'ged', `${uuidv4()}.${ext}`);
    const uploadUrl = await this.storageService.getPresignedUploadUrl(key, dto.mimeType);

    const document = this.documentRepo.create({
      tenantId,
      name: dto.filename,
      originalName: dto.filename,
      type: dto.type,
      mimeType: dto.mimeType,
      size: 0,
      s3Key: key,
      uploadedBy: userId,
      devisId: dto.devisId,
      clientId: dto.clientId,
    });
    const saved = await this.documentRepo.save(document);

    return { uploadUrl, documentId: saved.id, s3Key: key };
  }

  async findAll(tenantId: string, devisId?: string, clientId?: string) {
    const qb = this.documentRepo.createQueryBuilder('d')
      .where('d.tenant_id = :tenantId', { tenantId })
      .orderBy('d.created_at', 'DESC');

    if (devisId) qb.andWhere('d.devis_id = :devisId', { devisId });
    if (clientId) qb.andWhere('d.client_id = :clientId', { clientId });

    return qb.getMany();
  }

  async getDownloadUrl(id: string, tenantId: string): Promise<string> {
    const doc = await this.documentRepo.findOne({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('Document introuvable');
    return this.storageService.getPresignedUrl(doc.s3Key, 3600);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const doc = await this.documentRepo.findOne({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('Document introuvable');
    try { await this.storageService.deleteObject(doc.s3Key); } catch {}
    await this.documentRepo.remove(doc);
  }
}
