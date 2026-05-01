import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';

import { Client } from './entities/client.entity';
import { PaginatedResult, paginate } from '../../common/dto/pagination.dto';
import { CreateClientDto, ClientFilterDto, UpdateClientDto } from './dto/client.dto';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    private readonly dataSource: DataSource,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // FIND ALL — multi-tenant, paginé, recherche ILIKE
  // ─────────────────────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    filter: ClientFilterDto,
  ): Promise<PaginatedResult<Client>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    if (filter.search) {
      const term = `%${filter.search}%`;
      const [data, total] = await this.clientRepo.findAndCount({
        where: [
          { tenantId, name: ILike(term) },
          { tenantId, email: ILike(term) },
          { tenantId, phone: ILike(term) },
        ],
        order: { name: 'ASC' },
        skip,
        take: limit,
      });
      return paginate(data, total, filter);
    }

    const [data, total] = await this.clientRepo.findAndCount({
      where: { tenantId },
      order: { name: 'ASC' },
      skip,
      take: limit,
    });

    return paginate(data, total, filter);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FIND ONE — avec historique devis (count + total CA)
  // ─────────────────────────────────────────────────────────────────────────────

  async findOne(id: string, tenantId: string): Promise<any> {
    const client = await this.clientRepo.findOne({ where: { id, tenantId } });
    if (!client) {
      throw new NotFoundException(`Client ${id} introuvable`);
    }

    // Historique devis pour ce client
    const devisStats = await this.dataSource
      .query(
        `SELECT
           COUNT(*) AS "devisCount",
           COALESCE(SUM("totalTtc"), 0) AS "totalCa",
           MAX("createdAt") AS "lastDevisAt"
         FROM devis
         WHERE "clientId" = $1 AND "tenantId" = $2`,
        [id, tenantId],
      )
      .catch(() => [{ devisCount: 0, totalCa: 0, lastDevisAt: null }]);

    return {
      ...client,
      stats: {
        devisCount: Number(devisStats[0]?.devisCount ?? 0),
        totalCa: Number(devisStats[0]?.totalCa ?? 0),
        lastDevisAt: devisStats[0]?.lastDevisAt ?? null,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    _userId: string,
    dto: CreateClientDto,
  ): Promise<Client> {
    const client = this.clientRepo.create({ tenantId, ...dto });
    const saved = await this.clientRepo.save(client);
    this.logger.log(`Client créé : ${saved.id} (tenant ${tenantId})`);
    return saved;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────────────────

  async update(
    id: string,
    tenantId: string,
    dto: UpdateClientDto,
  ): Promise<Client> {
    const client = await this.clientRepo.findOne({ where: { id, tenantId } });
    if (!client) {
      throw new NotFoundException(`Client ${id} introuvable`);
    }

    await this.clientRepo.update({ id, tenantId }, dto as Partial<Client>);
    return this.clientRepo.findOne({ where: { id, tenantId } }) as Promise<Client>;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REMOVE — vérifier l'absence de devis actifs
  // ─────────────────────────────────────────────────────────────────────────────

  async remove(id: string, tenantId: string): Promise<{ message: string }> {
    const client = await this.clientRepo.findOne({ where: { id, tenantId } });
    if (!client) {
      throw new NotFoundException(`Client ${id} introuvable`);
    }

    // Vérifier aucun devis actif (statut != cancelled/rejected)
    const activeDevisCount = await this.dataSource
      .query(
        `SELECT COUNT(*) AS cnt
         FROM devis
         WHERE "clientId" = $1
           AND "tenantId" = $2
           AND status NOT IN ('cancelled', 'rejected')`,
        [id, tenantId],
      )
      .catch(() => [{ cnt: 0 }]);

    if (Number(activeDevisCount[0]?.cnt ?? 0) > 0) {
      throw new BadRequestException(
        'Impossible de supprimer ce client : des devis actifs y sont associés',
      );
    }

    await this.clientRepo.delete({ id, tenantId });
    return { message: 'Client supprimé' };
  }
}
