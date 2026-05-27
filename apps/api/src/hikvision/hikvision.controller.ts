import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import { HikvisionService } from './hikvision.service';
import { CreateTerminalDto } from './dto/create-terminal.dto';
import { UpdateTerminalDto } from './dto/update-terminal.dto';

@Controller('hikvision')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class HikvisionController {
  constructor(private readonly hikvisionService: HikvisionService) {}

  @Get('terminais')
  listarTerminais() {
    return this.hikvisionService.listarTerminais();
  }

  @Post('terminais')
  criarTerminal(@Body() dto: CreateTerminalDto) {
    return this.hikvisionService.criarTerminal(dto);
  }

  @Patch('terminais/:id')
  atualizarTerminal(@Param('id') id: string, @Body() dto: UpdateTerminalDto) {
    return this.hikvisionService.atualizarTerminal(id, dto);
  }

  @Delete('terminais/:id')
  removerTerminal(@Param('id') id: string) {
    return this.hikvisionService.removerTerminal(id);
  }

  @Post('terminais/:id/ping')
  pingTerminal(@Param('id') id: string) {
    return this.hikvisionService.pingTerminalById(id).then((status) => ({ status }));
  }

  @Get('sync-status')
  listarStatusSync() {
    return this.hikvisionService.listarStatusSync();
  }

  @Post('sync/:pessoaId/retry')
  reenviarSync(
    @Param('pessoaId') pessoaId: string,
    @Body() body: { role: 'MORADOR' | 'FUNCIONARIO' | 'VISITANTE' },
  ) {
    let role: Role;
    if (body.role === 'MORADOR') role = Role.MORADOR;
    else if (body.role === 'FUNCIONARIO') role = Role.FUNCIONARIO;
    else role = Role.VISITANTE;
    return this.hikvisionService.reenviarSync(pessoaId, role).then(() => ({ ok: true }));
  }
}
