import { Module } from '@nestjs/common';
import { VisitantesController } from './visitantes.controller';
import { VisitantesService } from './visitantes.service';
import { HikvisionModule } from '../hikvision/hikvision.module';
import { FotosModule } from '../fotos/fotos.module';

@Module({
  imports: [HikvisionModule, FotosModule],
  controllers: [VisitantesController],
  providers: [VisitantesService],
})
export class VisitantesModule {}
