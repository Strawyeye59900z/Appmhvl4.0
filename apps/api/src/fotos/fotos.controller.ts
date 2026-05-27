import {
  Controller,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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

  @Get('meu-status-facial')
  async meuStatusFacial(@Request() req: { user: { id: string; role: Role } }) {
    const status = await this.fotosService.calcularStatusFacial(req.user.id, req.user.role);
    return { status };
  }
}
