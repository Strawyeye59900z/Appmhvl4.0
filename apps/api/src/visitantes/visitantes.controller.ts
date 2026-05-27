import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import { VisitantesService } from './visitantes.service';
import { CreateVisitanteDto } from './dto/create-visitante.dto';

@Controller('visitantes')
export class VisitantesController {
  constructor(private readonly visitantesService: VisitantesService) {}

  // Público — info do token (sem auth)
  @Get('registrar-foto/:token')
  getTokenInfo(@Param('token') token: string) {
    return this.visitantesService.getTokenInfo(token);
  }

  // Público — registrar foto (sem auth)
  @Post('registrar-foto/:token')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async registrarFoto(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    return this.visitantesService.registrarFoto(token, file.buffer, file.mimetype);
  }

  // Morador autenticado
  @Get('meus')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MORADOR)
  listarMeus(@Request() req: { user: { id: string } }) {
    return this.visitantesService.listarMeus(req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MORADOR)
  criar(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateVisitanteDto,
  ) {
    return this.visitantesService.criarVisitante(req.user.id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MORADOR)
  revogar(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.visitantesService.revogarVisitante(req.user.id, id);
  }
}
