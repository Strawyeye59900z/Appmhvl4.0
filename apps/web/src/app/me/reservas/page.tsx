'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CalendarDays, Plus, Trash2, ChevronLeft, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { reservas as reservasApi } from '@/lib/api';

interface EspacoReserva {
  id: string;
  nome: string;
  tipo: 'DIARIO' | 'POR_HORA';
}

interface Slot {
  hora: string;
  disponivel: boolean;
}

interface Reserva {
  id: string;
  data: string;
  horaInicio: string | null;
  horaFim: string | null;
  observacao: string | null;
  espacoReserva: { id: string; nome: string; tipo: string };
}

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC', dateStyle: 'short' });
}

function formatHora(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toISOString().substring(11, 16);
}

function hoje() {
  return new Date().toISOString().split('T')[0];
}

export default function MinhasReservasPage() {
  const [view, setView] = useState<'lista' | 'nova'>('lista');

  // Lista
  const [minhas, setMinhas] = useState<Reserva[]>([]);
  const [loadingLista, setLoadingLista] = useState(true);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [erroLista, setErroLista] = useState('');

  // Nova reserva
  const [espacos, setEspacos] = useState<EspacoReserva[]>([]);
  const [espacoId, setEspacoId] = useState('');
  const [data, setData] = useState('');
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [dispDiario, setDispDiario] = useState<boolean | null>(null);
  const [horaInicio, setHoraInicio] = useState('');
  const [observacao, setObservacao] = useState('');
  const [loadingDisp, setLoadingDisp] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroNova, setErroNova] = useState('');

  const carregarMinhas = useCallback(async () => {
    setLoadingLista(true);
    try {
      setMinhas(await reservasApi.minhas());
    } catch {
      setMinhas([]);
    } finally {
      setLoadingLista(false);
    }
  }, []);

  useEffect(() => {
    carregarMinhas();
    reservasApi.espacos().then(setEspacos).catch(() => setEspacos([]));
  }, [carregarMinhas]);

  // Carrega disponibilidade quando espaço + data selecionados
  useEffect(() => {
    if (!espacoId || !data) { setSlots(null); setDispDiario(null); return; }
    setLoadingDisp(true);
    setSlots(null);
    setDispDiario(null);
    setHoraInicio('');
    reservasApi
      .disponibilidade(espacoId, data)
      .then((res: any) => {
        if (res.tipo === 'POR_HORA') setSlots(res.slots);
        else setDispDiario(res.disponivel);
      })
      .catch(() => {})
      .finally(() => setLoadingDisp(false));
  }, [espacoId, data]);

  async function handleCancelar(id: string) {
    setCancelando(id);
    setErroLista('');
    try {
      await reservasApi.cancelar(id);
      setMinhas((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      setErroLista(e.message ?? 'Erro ao cancelar');
    } finally {
      setCancelando(null);
    }
  }

  async function handleSalvar() {
    if (!espacoId || !data) return;
    setSalvando(true);
    setErroNova('');
    try {
      await reservasApi.criar({ espacoReservaId: espacoId, data, horaInicio: horaInicio || undefined, observacao: observacao || undefined });
      await carregarMinhas();
      setView('lista');
      setEspacoId(''); setData(''); setHoraInicio(''); setObservacao('');
    } catch (e: any) {
      setErroNova(e.message ?? 'Erro ao criar reserva');
    } finally {
      setSalvando(false);
    }
  }

  const espacoSelecionado = espacos.find((e) => e.id === espacoId);
  const podeConfirmar = espacoId && data && (
    espacoSelecionado?.tipo === 'DIARIO' ? dispDiario === true : !!horaInicio
  );

  // ── NOVA RESERVA ────────────────────────────────────────────────
  if (view === 'nova') {
    return (
      <div className="min-h-screen bg-muted/30 p-4 space-y-5 max-w-lg mx-auto">
        <div className="flex items-center gap-3 pt-2">
          <Button variant="ghost" size="icon" onClick={() => setView('lista')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Nova Reserva</h1>
        </div>

        <div className="space-y-4">
          {/* Espaço */}
          <div className="space-y-1.5">
            <Label>Espaço</Label>
            <Select value={espacoId} onValueChange={setEspacoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o espaço" />
              </SelectTrigger>
              <SelectContent>
                {espacos.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}{' '}
                    <span className="text-muted-foreground text-xs">
                      ({e.tipo === 'DIARIO' ? 'diário' : 'por hora'})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data */}
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" min={hoje()} value={data} onChange={(e) => setData(e.target.value)} />
          </div>

          {/* Disponibilidade */}
          {loadingDisp && (
            <p className="text-sm text-muted-foreground">Verificando disponibilidade...</p>
          )}

          {/* Espaço DIARIO */}
          {!loadingDisp && dispDiario !== null && (
            <Card className={dispDiario ? 'border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20' : 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'}>
              <CardContent className="p-4 text-sm font-medium">
                {dispDiario ? '✅ Disponível — clique em Confirmar para reservar.' : '❌ Já reservado para esta data.'}
              </CardContent>
            </Card>
          )}

          {/* Espaço POR_HORA — grid de slots */}
          {!loadingDisp && slots && (
            <div className="space-y-2">
              <Label>Horário (1h)</Label>
              <div className="grid grid-cols-4 gap-2">
                {slots.map((s) => (
                  <button
                    key={s.hora}
                    disabled={!s.disponivel}
                    onClick={() => setHoraInicio(s.hora)}
                    className={[
                      'rounded-md border px-2 py-1.5 text-sm font-medium transition-colors',
                      !s.disponivel
                        ? 'opacity-40 cursor-not-allowed bg-muted'
                        : horaInicio === s.hora
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-accent hover:text-accent-foreground',
                    ].join(' ')}
                  >
                    {s.hora}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Observação */}
          <div className="space-y-1.5">
            <Label>Observação (opcional)</Label>
            <Input
              placeholder="Ex: Aniversário, evento familiar..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          {erroNova && <p className="text-sm text-destructive">{erroNova}</p>}

          <Button className="w-full" disabled={!podeConfirmar || salvando} onClick={handleSalvar}>
            {salvando ? 'Salvando...' : 'Confirmar Reserva'}
          </Button>
        </div>
      </div>
    );
  }

  // ── LISTA ────────────────────────────────────────────────────────
  const futuras = minhas.filter((r) => new Date(r.data) >= new Date(hoje() + 'T00:00:00.000Z'));
  const passadas = minhas.filter((r) => new Date(r.data) < new Date(hoje() + 'T00:00:00.000Z'));

  return (
    <div className="min-h-screen bg-muted/30 p-4 space-y-6 max-w-lg mx-auto">
      {/* Navegação de seções */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 mt-2">
        <Link
          href="/me"
          className="flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
        >
          <Package className="h-4 w-4" /> Encomendas
        </Link>
        <span className="flex-1 flex items-center justify-center gap-2 rounded-md bg-background px-3 py-1.5 text-sm font-medium shadow-sm">
          <CalendarDays className="h-4 w-4" /> Reservas
        </span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Minhas Reservas</h1>
        <Button size="sm" onClick={() => setView('nova')}>
          <Plus className="h-4 w-4 mr-1" /> Nova
        </Button>
      </div>

      {erroLista && <p className="text-sm text-destructive">{erroLista}</p>}
      {loadingLista && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {!loadingLista && minhas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">Nenhuma reserva encontrada.</p>
          <Button variant="outline" size="sm" onClick={() => setView('nova')}>
            Fazer primeira reserva
          </Button>
        </div>
      )}

      {futuras.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Próximas</h2>
          {futuras.map((r) => (
            <ReservaCard key={r.id} r={r} onCancelar={handleCancelar} cancelando={cancelando} />
          ))}
        </section>
      )}

      {passadas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Histórico</h2>
          {passadas.map((r) => (
            <ReservaCard key={r.id} r={r} onCancelar={null} cancelando={cancelando} />
          ))}
        </section>
      )}
    </div>
  );
}

function ReservaCard({
  r,
  onCancelar,
  cancelando,
}: {
  r: Reserva;
  onCancelar: ((id: string) => void) | null;
  cancelando: string | null;
}) {
  function formatHora(iso: string | null) {
    if (!iso) return null;
    return new Date(iso).toISOString().substring(11, 16);
  }

  const horaInicio = formatHora(r.horaInicio);
  const horaFim = formatHora(r.horaFim);

  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <CalendarDays className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm">{r.espacoReserva.nome}</p>
            <Badge variant="outline" className="text-xs shrink-0">
              {r.espacoReserva.tipo === 'DIARIO' ? 'Diário' : 'Por hora'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date(r.data).toLocaleDateString('pt-BR', { timeZone: 'UTC', dateStyle: 'short' })}
            {horaInicio && ` · ${horaInicio} – ${horaFim}`}
          </p>
          {r.observacao && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{r.observacao}</p>
          )}
        </div>
        {onCancelar && (
          <Button
            variant="ghost"
            size="icon"
            disabled={cancelando === r.id}
            onClick={() => onCancelar(r.id)}
            className="text-destructive hover:text-destructive shrink-0"
            title="Cancelar reserva"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
