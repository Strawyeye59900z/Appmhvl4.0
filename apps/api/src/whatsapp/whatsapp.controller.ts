import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WhatsAppClient } from './whatsapp.client';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppClient) {}

  @Get('status')
  getStatus() {
    return { connected: this.whatsapp.isConnected() };
  }

  @Get('qr')
  getQR(@Res() res: Response) {
    const qr = this.whatsapp.getQR();
    if (!qr) return res.status(204).send();
    return res.json({ qr });
  }
}
