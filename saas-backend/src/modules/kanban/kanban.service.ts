import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export const KANBAN_COLUMNS = [
  { id: 'prospect', label: 'Prospects', color: '#94a3b8' },
  { id: 'devis_envoye', label: 'Devis envoyés', color: '#3b82f6' },
  { id: 'en_cours', label: 'En cours', color: '#f59e0b' },
  { id: 'facture', label: 'À facturer', color: '#8b5cf6' },
  { id: 'termine', label: 'Terminé', color: '#10b981' },
];

@Injectable()
export class KanbanService {
  constructor(private dataSource: DataSource) {}

  async getBoard(tenantId: string) {
    const rows = await this.dataSource.query(`
      SELECT d.id, d.numero, d.client_name, d.montant_ttc, d.statut,
             d.kanban_column, d.kanban_position, d.acompte_percent,
             d.date_debut, d.duree_jours, d.updated_at,
             c.phone as client_phone, c.email as client_email
      FROM devis d
      LEFT JOIN clients c ON c.id = d.client_id
      WHERE d.tenant_id = $1
      ORDER BY d.kanban_column, d.kanban_position ASC
    `, [tenantId]);

    const board: Record<string, any[]> = {};
    for (const col of KANBAN_COLUMNS) board[col.id] = [];

    for (const row of rows) {
      const colId = row.kanban_column ?? 'prospect';
      if (!board[colId]) board[colId] = [];
      board[colId].push(row);
    }

    return { columns: KANBAN_COLUMNS, board };
  }

  async moveCard(devisId: string, column: string, position: number, tenantId: string) {
    const validCols = KANBAN_COLUMNS.map(c => c.id);
    if (!validCols.includes(column)) throw new NotFoundException('Colonne invalide');

    await this.dataSource.query(`
      UPDATE devis SET kanban_column = $1, kanban_position = $2
      WHERE id = $3 AND tenant_id = $4
    `, [column, position, devisId, tenantId]);

    return { success: true };
  }

  async setAcompte(devisId: string, amount: number, tenantId: string) {
    await this.dataSource.query(`
      UPDATE devis SET acompte_recu = $1 WHERE id = $2 AND tenant_id = $3
    `, [amount, devisId, tenantId]);
    return { success: true };
  }
}
