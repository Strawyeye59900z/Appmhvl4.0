import {
  Controller, Get, Post, Delete,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import { ReservasService } from './reservas.service';
import { CreateReservaDto } from './dto/create-reserva.dto';

@Controller('reservas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReservasController {
  constructor(private readonly service: ReservasService) {}

  @Get('espacos')
  @Roles(Role.ADMIN, Role.MORADOR)
  findEspacos() {
    return this.service.findEspacos();
  }

  @Get('disponibilidade')
  @Roles(Role.ADMIN, Role.MORADOR)
  disponibilidade(
    @Query('espacoId') espacoId: string,
    @Query('data') data: string,
  ) {
    return this.service.disponibilidade(espacoId, data);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MORADOR)
  create(@Body() dto: CreateReservaDto, @Request() req: any) {
    // Para ADMIN: req.user.id é o apartamentoId? Não — admin usa apartamentoId do DTO ou cria em nome de outro.
    // Simplificação: admin pode passar apartamentoId no body; morador usa o seu (sub do JWT = apartamentoId).
    const apartamentoId = req.user.role === Role.ADMIN && dto.apartamentoId
      ? dto.apartamentoId
      : req.user.id;
    return this.service.create(dto, apartamentoId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.MORADOR)
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.service.cancel(id, req.user.id, req.user.role === Role.ADMIN);
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll(
    @Query('espacoId') espacoId?: string,
    @Query('data') data?: string,
    @Query('apartamentoId') apartamentoId?: string,
  ) {
    return this.service.findAll({ espacoId, data, apartamentoId });
  }

  @Get('minhas')
  @Roles(Role.MORADOR)
  findMinhas(@Request() req: any) {
    return this.service.findMinhas(req.user.id);
  }
}
