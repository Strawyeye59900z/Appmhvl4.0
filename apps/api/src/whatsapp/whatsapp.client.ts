import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class WhatsAppClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppClient.name);
  private socket: WASocket | null = null;
  private qrBase64: string | null = null;
  private connected = false;
  private readonly authDir = path.join(process.cwd(), 'baileys-auth');

  async onModuleInit() {
    if (!fs.existsSync(this.authDir)) fs.mkdirSync(this.authDir, { recursive: true });
    await this.connect();
  }

  onModuleDestroy() {
    this.socket?.end(undefined);
  }

  private async connect() {
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

    this.socket = makeWASocket({ auth: state, printQRInTerminal: false, logger: undefined as any });

    this.socket.ev.on('creds.update', saveCreds);

    this.socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qrBase64 = await QRCode.toDataURL(qr);
        this.logger.log('QR code gerado — acesse /whatsapp/qr no painel admin');
      }

      if (connection === 'open') {
        this.connected = true;
        this.qrBase64 = null;
        this.logger.log('WhatsApp conectado');
      }

      if (connection === 'close') {
        this.connected = false;
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        this.logger.warn(`Conexão encerrada — reconectar: ${shouldReconnect}`);
        if (shouldReconnect) {
          setTimeout(() => this.connect(), 5000);
        } else {
          // Logged out: limpa auth para forçar novo QR
          fs.rmSync(this.authDir, { recursive: true, force: true });
          fs.mkdirSync(this.authDir, { recursive: true });
          setTimeout(() => this.connect(), 1000);
        }
      }
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  getQR(): string | null {
    return this.qrBase64;
  }

  async sendMessage(to: string, text: string): Promise<void> {
    if (!this.socket || !this.connected) {
      this.logger.warn(`WhatsApp não conectado — mensagem para ${to} descartada`);
      return;
    }
    const jid = `${to.replace(/\D/g, '')}@s.whatsapp.net`;
    await this.socket.sendMessage(jid, { text });
  }
}
