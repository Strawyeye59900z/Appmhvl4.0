'use client';

import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, RotateCcw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { reservas as reservasApi } from '@/lib/api';

interface EspacoReserva {
  id: string;
  nome: string;
  tipo: 'DIARIO' | 'POR_HORA';
}

interface Reserva {
  id: string;
  data: string;
  horaInicio: string | null;
  horaFim: string | null;
  observacao: string | null;
  apartamento: { id: string; numero: string; bloco: string | null };
  espacoReserva: { id: string; nome: string; tipo: string };
}

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function formatHora(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toISOString().substring(11, 16);
}

function formatApt(apt: { numero: string; bloco: string | null }) {
  return apt.bloco ? `${apt.bloco} - ${apt.numero}` : apt.numero;
}

export default function AdminReservasPage() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [espacos, setEspacos] = useState<EspacoReserva[]>([]);
  const [filtroEspaco, setFiltroEspaco] = useState('TODOS');
  const [filtroData, setFiltroData] = useState('');
  const [loading, setLoading] = useState(false);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    reservasApi.espacos().then(setEspacos).catch(() => setEspacos([]));
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const params: any = {};
      if (filtroEspaco && filtroEspaco !== 'TODOS') params.espacoId = filtroEspaco;
      if (filtroData) params.data = filtroData;
      const data = await reservasApi.listar(params);
      setReservas(data);
    } catch {
      setReservas([]);
    } finally {
      setLoading(false);
    }
  }, [filtroEspaco, filtroData]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleCancelar(id: string) {
    setCancelando(id);
    setErro('');
    try {
      await reservasApi.cancelar(id);
      setReservas((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      setErro(e.message ?? 'Erro ao cancelar reserva');
    } finally {
      setCancelando(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Reservas</h1>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filtroEspaco} onValueChange={setFiltroEspaco}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Todos os espaços" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os espaços</SelectItem>
            {espacos.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="w-44"
          value={filtroData}
          onChange={(ev) => setFiltroData(ev.target.value)}
        />

        <Button variant="ghost" size="icon" onClick={carregar} title="Atualizar">
          <RotateCcw className="h-4 w-4" />
        </Button>

        <span className="text-sm text-muted-foreground ml-auto">
          {reservas.length} {reservas.length === 1 ? 'reserva' : 'reservas'}
        </span>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}
      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {!loading && reservas.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma reserva encontrada.</p>
      )}

      {!loading && reservas.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Espaço</th>
                <th className="text-left px-4 py-3 font-medium">Apartamento</th>
                <th className="text-left px-4 py-3 font-medium">Data</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Horário</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Observação</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reservas.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {r.espacoReserva.nome}
                      <Badge variant="outline" className="text-xs">
                        {r.espacoReserva.tipo === 'DIARIO' ? 'Diário' : 'Por hora'}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3">{formatApt(r.apartamento)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatData(r.data)}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground whitespace-nowrap">
                    {r.horaInicio ? `${formatHora(r.horaInicio)} – ${formatHora(r.horaFim)}` : 'Dia todo'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {r.observacao ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={cancelando === r.id}
                      onClick={() => handleCancelar(r.id)}
                      title="Cancelar reserva"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
