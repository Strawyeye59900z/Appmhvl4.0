-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'FUNCIONARIO', 'MORADOR');

-- CreateEnum
CREATE TYPE "EncomendaStatus" AS ENUM ('PENDENTE', 'RETIRADA', 'DEVOLVIDA');

-- CreateEnum
CREATE TYPE "TipoReserva" AS ENUM ('DIARIO', 'POR_HORA');

-- CreateEnum
CREATE TYPE "FacialSyncStatus" AS ENUM ('PENDENTE', 'EM_FILA', 'ENVIANDO', 'OK', 'FALHOU');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funcionario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "fotoUrl" TEXT,
    "passwordHash" TEXT,
    "primeiroAcesso" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Apartamento" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "bloco" TEXT,
    "senhaHash" TEXT,
    "primeiroAcesso" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Apartamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Morador" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "whatsapp" TEXT,
    "fotoUrl" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "apartamentoId" TEXT NOT NULL,

    CONSTRAINT "Morador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encomenda" (
    "id" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "EncomendaStatus" NOT NULL DEFAULT 'PENDENTE',
    "notificado" BOOLEAN NOT NULL DEFAULT false,
    "retiradoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "moradorId" TEXT NOT NULL,
    "funcionarioId" TEXT NOT NULL,

    CONSTRAINT "Encomenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EspacoReserva" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoReserva" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EspacoReserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "horaInicio" TIME,
    "horaFim" TIME,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "apartamentoId" TEXT NOT NULL,
    "espacoReservaId" TEXT NOT NULL,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracao" (
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT,
    "entidadeId" TEXT,
    "payload" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HikvisionTerminal" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "porta" INTEGER NOT NULL DEFAULT 80,
    "username" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoPing" TIMESTAMP(3),
    "ultimoStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HikvisionTerminal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacialSync" (
    "id" TEXT NOT NULL,
    "status" "FacialSyncStatus" NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimoErro" TEXT,
    "enviadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "moradorId" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,

    CONSTRAINT "FacialSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Apartamento_numero_key" ON "Apartamento"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Morador_cpf_key" ON "Morador"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "EspacoReserva_nome_key" ON "EspacoReserva"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_espacoReservaId_data_horaInicio_key" ON "Reserva"("espacoReservaId", "data", "horaInicio");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entidade_entidadeId_idx" ON "AuditLog"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "FacialSync_status_updatedAt_idx" ON "FacialSync"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FacialSync_moradorId_terminalId_key" ON "FacialSync"("moradorId", "terminalId");

-- AddForeignKey
ALTER TABLE "Morador" ADD CONSTRAINT "Morador_apartamentoId_fkey" FOREIGN KEY ("apartamentoId") REFERENCES "Apartamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encomenda" ADD CONSTRAINT "Encomenda_moradorId_fkey" FOREIGN KEY ("moradorId") REFERENCES "Morador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encomenda" ADD CONSTRAINT "Encomenda_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_apartamentoId_fkey" FOREIGN KEY ("apartamentoId") REFERENCES "Apartamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_espacoReservaId_fkey" FOREIGN KEY ("espacoReservaId") REFERENCES "EspacoReserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacialSync" ADD CONSTRAINT "FacialSync_moradorId_fkey" FOREIGN KEY ("moradorId") REFERENCES "Morador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacialSync" ADD CONSTRAINT "FacialSync_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "HikvisionTerminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
