/**
 * Enums, tipos e constantes compartilhados entre API (NestJS) e Web (Next.js).
 * Espelham o schema Prisma — manter sincronizado ao editar prisma/schema.prisma.
 */

export enum StatusFacial {
  PENDENTE = 'PENDENTE',
  REGISTRADO = 'REGISTRADO',
}

export enum TipoEncomenda {
  CAIXA = 'CAIXA',
  ENVELOPE = 'ENVELOPE',
  SACOLA = 'SACOLA',
}

export enum StatusEncomenda {
  PENDENTE = 'PENDENTE',
  RETIRADA = 'RETIRADA',
  CANCELADA = 'CANCELADA',
}

export enum WhatsappStatus {
  PENDENTE = 'PENDENTE',
  ENVIADA = 'ENVIADA',
  FALHOU = 'FALHOU',
}

export enum Espaco {
  QUADRA = 'QUADRA',
  CHURRASQUEIRA = 'CHURRASQUEIRA',
  SALAO_FESTAS = 'SALAO_FESTAS',
}

export enum FacialSyncStatus {
  PENDENTE = 'PENDENTE',
  EM_FILA = 'EM_FILA',
  ENVIANDO = 'ENVIANDO',
  OK = 'OK',
  FALHOU = 'FALHOU',
}

export type UserRole = 'admin' | 'funcionario' | 'morador';

export const REGRAS = {
  fotoMaxBytes: 1024 * 1024,                    // 1 MB
  encomendaJanelaEditMin: 10,                   // 10 min para editar encomenda
  reservaAntecedenciaDias: 90,                  // até 90 dias de antecedência
  quadraHorasMaxPorAp: 4,                       // máximo 4h/AP/dia na quadra
  quadraHoraMin: 0,
  quadraHoraMax: 23,
  cancelamentoChurrasqueiraSalaoHorasAntes: 24,
  facialSyncMaxTentativas: 5,
} as const;
