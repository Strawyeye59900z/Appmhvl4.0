-- CreateEnum
CREATE TYPE "TipoVisitante" AS ENUM ('PERSONAL', 'FUNCIONARIO_TEMP');

-- CreateTable
CREATE TABLE "Visitante" (
    "id" TEXT NOT NULL,
    "codigoFacial" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoVisitante" NOT NULL,
    "fotoUrl" TEXT,
    "token" TEXT NOT NULL,
    "tokenUsado" BOOLEAN NOT NULL DEFAULT false,
    "validoAte" TIMESTAMP(3) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "moradorId" TEXT NOT NULL,

    CONSTRAINT "Visitante_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "FacialSync" ADD COLUMN "visitanteId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Visitante_codigoFacial_key" ON "Visitante"("codigoFacial");

-- CreateIndex
CREATE UNIQUE INDEX "Visitante_token_key" ON "Visitante"("token");

-- CreateIndex
CREATE UNIQUE INDEX "FacialSync_visitanteId_terminalId_key" ON "FacialSync"("visitanteId", "terminalId");

-- AddForeignKey
ALTER TABLE "Visitante" ADD CONSTRAINT "Visitante_moradorId_fkey" FOREIGN KEY ("moradorId") REFERENCES "Morador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacialSync" ADD CONSTRAINT "FacialSync_visitanteId_fkey" FOREIGN KEY ("visitanteId") REFERENCES "Visitante"("id") ON DELETE SET NULL ON UPDATE CASCADE;
