import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { ApartamentosModule } from './apartamentos/apartamentos.module';
import { MoradoresModule } from './moradores/moradores.module';
import { FuncionariosModule } from './funcionarios/funcionarios.module';
import { EncomendasModule } from './encomendas/encomendas.module';
import { ReservasModule } from './reservas/reservas.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { FotosModule } from './fotos/fotos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    QueueModule,
    AuthModule,
    ApartamentosModule,
    MoradoresModule,
    FuncionariosModule,
    EncomendasModule,
    ReservasModule,
    WhatsAppModule,
    FotosModule,
  ],
})
export class AppModule {}
