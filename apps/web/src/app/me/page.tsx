'use client';

import { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { encomendas as encomendasApi } from '@/lib/api';

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

export default function MePage() {
  const [encomendas, setEncomendas] = useState<Encomenda[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    encomendasApi
      .minhas()
      .then(setEncomendas)
      .catch(() => setEncomendas([]))
      .finally(() => setLoading(false));
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
      <div className="flex items-center gap-3 pt-2">
        <Package className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Minhas Encomendas</h1>
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
