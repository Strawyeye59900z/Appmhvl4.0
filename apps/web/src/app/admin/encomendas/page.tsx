'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { encomendas as encomendasApi } from '@/lib/api';

interface Encomenda {
  id: string;
  descricao: string | null;
  status: 'PENDENTE' | 'RETIRADA' | 'DEVOLVIDA';
  createdAt: string;
  retiradoEm: string | null;
  morador: { id: string; nome: string; apartamento: { numero: string; bloco: string | null } };
  funcionario: { id: string; nome: string };
}

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente',
  RETIRADA: 'Retirada',
  DEVOLVIDA: 'Devolvida',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  PENDENTE: 'default',
  RETIRADA: 'secondary',
  DEVOLVIDA: 'outline',
};

export default function AdminEncomendasPage() {
  const [encomendas, setEncomendas] = useState<Encomenda[]>([]);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await encomendasApi.listar(filtroStatus ? { status: filtroStatus } : {});
      setEncomendas(data);
    } catch {
      setEncomendas([]);
    } finally {
      setLoading(false);
    }
  }, [filtroStatus]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function formatApt(apt: { numero: string; bloco: string | null }) {
    return apt.bloco ? `${apt.bloco} - ${apt.numero}` : apt.numero;
  }

  function formatData(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Package className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Encomendas</h1>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="PENDENTE">Pendentes</SelectItem>
            <SelectItem value="RETIRADA">Retiradas</SelectItem>
            <SelectItem value="DEVOLVIDA">Devolvidas</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" size="icon" onClick={carregar} title="Atualizar">
          <RotateCcw className="h-4 w-4" />
        </Button>

        <span className="text-sm text-muted-foreground ml-auto">
          {encomendas.length} {encomendas.length === 1 ? 'encomenda' : 'encomendas'}
        </span>
      </div>

      {/* Tabela responsiva */}
      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {!loading && encomendas.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma encomenda encontrada.</p>
      )}

      {!loading && encomendas.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Morador</th>
                <th className="text-left px-4 py-3 font-medium">Apartamento</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Descrição</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Registrado por</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Data</th>
                <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Retirada em</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {encomendas.map((enc) => (
                <tr key={enc.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">{enc.morador.nome}</td>
                  <td className="px-4 py-3">{formatApt(enc.morador.apartamento)}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {enc.descricao ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[enc.status]}>
                      {STATUS_LABEL[enc.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {enc.funcionario.nome}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground whitespace-nowrap">
                    {formatData(enc.createdAt)}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground whitespace-nowrap">
                    {enc.retiradoEm ? formatData(enc.retiradoEm) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
