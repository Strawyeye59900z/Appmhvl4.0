import {
  Controller, Get, Post, Patch,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import { EncomendasService } from './encomendas.service';
import { CreateEncomendaDto } from './dto/create-encomenda.dto';
import { EncomendaStatus } from '@prisma/client';

@Controller('encomendas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EncomendasController {
  constructor(private readonly service: EncomendasService) {}

  @Post()
  @Roles(Role.FUNCIONARIO)
  create(@Body() dto: CreateEncomendaDto, @Request() req: any) {
    return this.service.create(dto, req.user.id);
  }

  @Patch(':id/retirada')
  @Roles(Role.FUNCIONARIO)
  confirmarRetirada(@Param('id') id: string, @Request() req: any) {
    return this.service.confirmarRetirada(id, req.user.id);
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll(
    @Query('status') status?: EncomendaStatus,
    @Query('moradorId') moradorId?: string,
  ) {
    return this.service.findAll({ status, moradorId });
  }

  @Get('pendentes')
  @Roles(Role.FUNCIONARIO)
  findPendentes() {
    return this.service.findPendentes();
  }

  @Get('minhas')
  @Roles(Role.MORADOR)
  findMinhas(@Request() req: any) {
    return this.service.findMinhas(req.user.id);
  }
}
