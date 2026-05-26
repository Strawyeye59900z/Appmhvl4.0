import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { ApartamentosModule } from './apartamentos/apartamentos.module';
import { MoradoresModule } from './moradores/moradores.module';
import { FuncionariosModule } from './funcionarios/funcionarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QueueModule,
    AuthModule,
    ApartamentosModule,
    MoradoresModule,
    FuncionariosModule,
  ],
})
export class AppModule {}
