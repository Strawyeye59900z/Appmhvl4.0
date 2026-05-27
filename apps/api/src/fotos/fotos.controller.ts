import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FotosService } from './fotos.service';
import { Role } from '../common/roles.enum';

@Controller('fotos')
@UseGuards(JwtAuthGuard)
export class FotosController {
  constructor(private readonly fotosService: FotosService) {}

  @Post('minha-foto')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadFoto(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user: { id: string; role: Role } },
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    const fotoUrl = await this.fotosService.salvarFoto(
      req.user.id,
      req.user.role,
      file.buffer,
      file.mimetype,
    );
    return { fotoUrl };
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadFotoMorador(
    @UploadedFile() file: Express.Multer.File,
    @Query('moradorId') moradorId: string,
    @Request() req: { user: { id: string; role: Role } },
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    if (!moradorId) throw new BadRequestException('moradorId é obrigatório');
    const fotoUrl = await this.fotosService.salvarFotoById(moradorId, Role.MORADOR, file.buffer, file.mimetype);
    return { fotoUrl };
  }

  @Get('meu-status-facial')
  async meuStatusFacial(@Request() req: { user: { id: string; role: Role } }) {
    const status = await this.fotosService.calcularStatusFacial(req.user.id, req.user.role);
    return { status };
  }

  // Admin: faz upload de foto para qualquer morador ou funcionário
  @Post('admin/upload')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadFotoAdmin(
    @UploadedFile() file: Express.Multer.File,
    @Query('pessoaId') pessoaId: string,
    @Query('tipo') tipo: 'MORADOR' | 'FUNCIONARIO',
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    if (!pessoaId) throw new BadRequestException('pessoaId é obrigatório');
    if (tipo !== 'MORADOR' && tipo !== 'FUNCIONARIO') throw new BadRequestException('tipo deve ser MORADOR ou FUNCIONARIO');
    const role = tipo === 'MORADOR' ? Role.MORADOR : Role.FUNCIONARIO;
    const fotoUrl = await this.fotosService.salvarFotoById(pessoaId, role, file.buffer, file.mimetype);
    return { fotoUrl };
  }
}
