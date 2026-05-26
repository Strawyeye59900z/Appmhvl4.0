import { Module } from '@nestjs/common';
import { ApartamentosController } from './apartamentos.controller';
import { ApartamentosService } from './apartamentos.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ApartamentosController],
  providers: [ApartamentosService],
  exports: [ApartamentosService],
})
export class ApartamentosModule {}
