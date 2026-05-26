import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, ParseBoolPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import { ApartamentosService } from './apartamentos.service';
import { CreateApartamentoDto } from './dto/create-apartamento.dto';
import { UpdateApartamentoDto } from './dto/update-apartamento.dto';

@Controller('apartamentos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApartamentosController {
  constructor(private readonly service: ApartamentosService) {}

  @Get()
  @Roles(Role.ADMIN, Role.FUNCIONARIO)
  findAll(@Query('ativo', new ParseBoolPipe({ optional: true })) ativo?: boolean) {
    return this.service.findAll(ativo);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.FUNCIONARIO)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateApartamentoDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateApartamentoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
