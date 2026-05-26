/**
 * Enums, tipos e constantes compartilhados entre API (NestJS) e Web (Next.js).
 * Espelham o schema Prisma — manter sincronizado ao editar prisma/schema.prisma.
 */

export enum Role {
  ADMIN = 'ADMIN',
  FUNCIONARIO = 'FUNCIONARIO',
  MORADOR = 'MORADOR',
}

export enum EncomendaStatus {
  PENDENTE = 'PENDENTE',
  RETIRADA = 'RETIRADA',
  DEVOLVIDA = 'DEVOLVIDA',
}

export enum TipoReserva {
  DIARIO = 'DIARIO',
  POR_HORA = 'POR_HORA',
}

export enum FacialSyncStatus {
  PENDENTE = 'PENDENTE',
  EM_FILA = 'EM_FILA',
  ENVIANDO = 'ENVIANDO',
  OK = 'OK',
  FALHOU = 'FALHOU',
}

export type JwtPayload = {
  sub: string;
  role: Role;
  iat: number;
  exp: number;
};

export const REGRAS = {
  fotoMaxBytes: 1024 * 1024,
  encomendaJanelaEditMin: 10,
  reservaAntecedenciaDias: 90,
  quadraHorasMaxPorAp: 4,
  cancelamentoChurrasqueiraSalaoHorasAntes: 24,
  facialSyncMaxTentativas: 5,
} as const;
