-- AlterTable
ALTER TABLE "FacialSync" ADD COLUMN     "funcionarioId" TEXT,
ALTER COLUMN "moradorId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "FacialSync_funcionarioId_terminalId_key" ON "FacialSync"("funcionarioId", "terminalId");

-- AddForeignKey
ALTER TABLE "FacialSync" ADD CONSTRAINT "FacialSync_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
