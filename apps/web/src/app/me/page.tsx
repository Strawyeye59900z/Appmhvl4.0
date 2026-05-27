'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Package, Clock, CheckCircle, RotateCcw, CalendarDays, Camera, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { encomendas as encomendasApi, fotos as fotosApi } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { FotoCaptura } from '@/components/ui/foto-captura';

interface Encomenda {
  id: string;
  descricao: string | null;
  status: 'PENDENTE' | 'RETIRADA' | 'DEVOLVIDA';
  createdAt: string;
  retiradoEm: string | null;
  morador: { id: string; nome: string };
  funcionario: { id: string; nome: string };
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'PENDENTE') return <Clock className="h-5 w-5 text-amber-500" />;
  if (status === 'RETIRADA') return <CheckCircle className="h-5 w-5 text-green-500" />;
  return <RotateCcw className="h-5 w-5 text-muted-foreground" />;
}

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Aguardando retirada',
  RETIRADA: 'Retirada',
  DEVOLVIDA: 'Devolvida',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  PENDENTE: 'default',
  RETIRADA: 'secondary',
  DEVOLVIDA: 'outline',
};

const FACIAL_LABEL: Record<string, string> = {
  OK: 'Facial: Registrado ✓',
  PENDENTE: 'Facial: Pendente',
  PARCIALMENTE_OK: 'Facial: Parcial',
  FALHOU: 'Facial: Falha',
  SEM_FOTO: 'Facial: Sem foto',
};

const FACIAL_CLASS: Record<string, string> = {
  OK: 'text-green-600',
  PENDENTE: 'text-amber-500',
  PARCIALMENTE_OK: 'text-orange-500',
  FALHOU: 'text-destructive',
  SEM_FOTO: 'text-muted-foreground',
};

export default function MePage() {
  const [encomendas, setEncomendas] = useState<Encomenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [statusFacial, setStatusFacial] = useState<string | null>(null);
  const [dialogFotoAberto, setDialogFotoAberto] = useState(false);

  useEffect(() => {
    encomendasApi
      .minhas()
      .then(setEncomendas)
      .catch(() => setEncomendas([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fotosApi.meuStatusFacial()
      .then((res) => {
        setStatusFacial(res.status);
      })
      .catch(() => {});

    const session = getSession();
    if (session) {
      const userId = session.sub;
      if (userId) {
        const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3001';
        fetch(`${apiBase}/uploads/fotos/${userId}.jpg`, { method: 'HEAD' })
          .then((r) => { if (r.ok) setFotoUrl(`/uploads/fotos/${userId}.jpg`); })
          .catch(() => {});
      }
    }
  }, []);

  const handleFotoSalva = useCallback((novaUrl: string) => {
    setFotoUrl(novaUrl);
    setDialogFotoAberto(false);
    fotosApi.meuStatusFacial().then((r) => setStatusFacial(r.status)).catch(() => {});
  }, []);

  const pendentes = encomendas.filter((e) => e.status === 'PENDENTE');
  const historico = encomendas.filter((e) => e.status !== 'PENDENTE');

  function formatData(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 space-y-6 max-w-lg mx-auto">
      {/* Avatar + badge */}
      <div className="flex flex-col items-center gap-2 mb-6">
        <button
          className="relative group"
          onClick={() => setDialogFotoAberto(true)}
          aria-label="Atualizar foto de perfil"
        >
          <div className="w-24 h-24 rounded-full bg-muted border-2 overflow-hidden">
            {fotoUrl ? (
              <img
                src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3001'}${fotoUrl}`}
                alt="Foto de perfil"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Camera className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1 group-hover:scale-110 transition-transform">
            <Camera className="h-3 w-3" />
          </div>
        </button>

        {statusFacial && (
          <span className={`text-xs font-medium ${FACIAL_CLASS[statusFacial] ?? 'text-muted-foreground'}`}>
            {FACIAL_LABEL[statusFacial] ?? statusFacial}
          </span>
        )}
      </div>

      {/* Modal simples para atualizar foto (dialog.tsx não existe no projeto) */}
      {dialogFotoAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setDialogFotoAberto(false); }}
        >
          <div className="bg-background rounded-xl border shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Atualizar foto de perfil</h2>
              <button
                onClick={() => setDialogFotoAberto(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-center py-4">
              <FotoCaptura label="Abrir câmera" onSuccess={handleFotoSalva} />
            </div>
          </div>
        </div>
      )}

      {/* Navegação de seções */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 mt-2">
        <span className="flex-1 flex items-center justify-center gap-2 rounded-md bg-background px-3 py-1.5 text-sm font-medium shadow-sm">
          <Package className="h-4 w-4" /> Encomendas
        </span>
        <Link
          href="/me/reservas"
          className="flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
        >
          <CalendarDays className="h-4 w-4" /> Reservas
        </Link>
      </div>

      {/* Pendentes */}
      {pendentes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Aguardando retirada
          </h2>
          {pendentes.map((enc) => (
            <Card key={enc.id} className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
              <CardContent className="p-4 flex items-start gap-3">
                <StatusIcon status={enc.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{enc.morador.nome}</p>
                    <Badge variant={STATUS_VARIANT[enc.status]} className="shrink-0 text-xs">
                      {STATUS_LABEL[enc.status]}
                    </Badge>
                  </div>
                  {enc.descricao && (
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{enc.descricao}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Chegou em {formatData(enc.createdAt)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {encomendas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Package className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">Nenhuma encomenda encontrada.</p>
        </div>
      )}

      {/* Histórico */}
      {historico.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Histórico
          </h2>
          {historico.map((enc) => (
            <Card key={enc.id}>
              <CardContent className="p-4 flex items-start gap-3">
                <StatusIcon status={enc.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{enc.morador.nome}</p>
                    <Badge variant={STATUS_VARIANT[enc.status]} className="shrink-0 text-xs">
                      {STATUS_LABEL[enc.status]}
                    </Badge>
                  </div>
                  {enc.descricao && (
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{enc.descricao}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {enc.retiradoEm
                      ? `Retirada em ${formatData(enc.retiradoEm)}`
                      : `Registrada em ${formatData(enc.createdAt)}`}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
