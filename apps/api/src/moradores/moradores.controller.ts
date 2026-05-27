import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import { MoradoresService } from './moradores.service';
import { CreateMoradorDto } from './dto/create-morador.dto';
import { UpdateMoradorDto } from './dto/update-morador.dto';

@Controller('moradores')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MoradoresController {
  constructor(private readonly service: MoradoresService) {}

  // MORADOR lista os moradores do seu próprio apartamento
  @Get('meus')
  @Roles(Role.MORADOR)
  findMeus(@Request() req: any) {
    return this.service.findAll(req.user.id); // sub = apartamentoId
  }

  @Get()
  @Roles(Role.ADMIN, Role.FUNCIONARIO)
  findAll(@Query('apartamentoId') apartamentoId?: string) {
    return this.service.findAll(apartamentoId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.FUNCIONARIO)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // MORADOR pode cadastrar moradores no seu próprio apartamento
  @Post()
  @Roles(Role.ADMIN, Role.MORADOR)
  create(@Body() dto: CreateMoradorDto, @Request() req: any) {
    if (req.user.role === Role.MORADOR) {
      dto.apartamentoId = req.user.id; // força o apartamento correto
    }
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateMoradorDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.MORADOR)
  async remove(@Param('id') id: string, @Request() req: any) {
    if (req.user.role === Role.MORADOR) {
      // Garante que o morador pertence ao apartamento do usuário logado
      await this.service.removeDoApartamento(id, req.user.id);
      return;
    }
    return this.service.remove(id);
  }
}
