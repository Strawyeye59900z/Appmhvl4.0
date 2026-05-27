'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { whatsapp as whatsappApi } from '@/lib/api';

export default function WhatsAppPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const status = await whatsappApi.status();
      setConnected(status.connected);

      if (!status.connected) {
        try {
          const qrRes = await whatsappApi.qr();
          setQr(qrRes?.qr ?? null);
        } catch {
          setQr(null);
        }
      } else {
        setQr(null);
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      if (!connected) refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [refresh, connected]);

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">WhatsApp</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Status da conexão</CardTitle>
            <Button variant="ghost" size="icon" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {connected === null ? (
            <p className="text-sm text-muted-foreground">Verificando...</p>
          ) : connected ? (
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-green-600" />
              <Badge variant="outline" className="text-green-600 border-green-600">
                Conectado
              </Badge>
              <span className="text-sm text-muted-foreground ml-2">
                Notificações de encomendas ativas
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <WifiOff className="h-5 w-5 text-destructive" />
              <Badge variant="destructive">Desconectado</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {!connected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Escanear QR Code</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {qr ? (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo → escaneie o código abaixo:
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR Code WhatsApp" className="w-56 h-56 rounded-lg border" />
                <p className="text-xs text-muted-foreground">
                  O código atualiza automaticamente a cada 5 segundos
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-6">
                Aguardando geração do QR code...
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
