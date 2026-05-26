import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
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

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateMoradorDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateMoradorDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
