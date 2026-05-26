'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { encomendas as encomendasApi, moradores as moradoresApi } from '@/lib/api';

interface Morador {
  id: string;
  nome: string;
  apartamento: { numero: string; bloco: string | null };
}

interface Encomenda {
  id: string;
  descricao: string | null;
  createdAt: string;
  morador: { id: string; nome: string; apartamento: { numero: string; bloco: string | null } };
  funcionario: { id: string; nome: string };
}

const TIPOS = ['Caixa', 'Pacote', 'Carta'];
const ORIGENS_RAPIDAS = ['Amazon', 'Mercado Livre', 'Shopee', 'iFood', 'Correios'];

function BotaoSelecao({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: string[];
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {opcoes.map((op) => (
        <button
          key={op}
          type="button"
          onClick={() => onChange(op === valor ? '' : op)}
          className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
            valor === op
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-border hover:bg-muted'
          }`}
        >
          {op}
        </button>
      ))}
    </div>
  );
}

export default function PorteiroPage() {
  const [moradores, setMoradores] = useState<Morador[]>([]);
  const [pendentes, setPendentes] = useState<Encomenda[]>([]);
  const [moradorId, setMoradorId] = useState('');
  const [tipo, setTipo] = useState('');
  const [origem, setOrigem] = useState('');
  const [origemCustom, setOrigemCustom] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const carregarPendentes = useCallback(async () => {
    try {
      const data = await encomendasApi.pendentes();
      setPendentes(data);
    } catch { /* exibe lista vazia */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      moradoresApi.list().then(setMoradores).catch(() => {}),
      carregarPendentes(),
    ]).finally(() => setLoading(false));
  }, [carregarPendentes]);

  function buildDescricao() {
    const partes: string[] = [];
    if (tipo) partes.push(tipo);
    const ori = origem === 'Outros' ? origemCustom.trim() : origem;
    if (ori) partes.push(ori);
    return partes.join(' · ') || undefined;
  }

  async function handleRegistrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setSucesso('');
    setRegistrando(true);
    try {
      await encomendasApi.criar({ moradorId, descricao: buildDescricao() });
      setSucesso('Encomenda registrada!');
      setMoradorId(''); setTipo(''); setOrigem(''); setOrigemCustom('');
      await carregarPendentes();
      setTimeout(() => setSucesso(''), 3000);
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao registrar encomenda');
    } finally {
      setRegistrando(false);
    }
  }

  async function handleRetirada(id: string) {
    try {
      await encomendasApi.confirmarRetirada(id);
      await carregarPendentes();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao confirmar retirada');
    }
  }

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
        <h1 className="text-2xl font-semibold">Portaria</h1>
      </div>

      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registrar encomenda</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegistrar} className="space-y-5">

            <div className="space-y-2">
              <Label>Morador</Label>
              <Select value={moradorId} onValueChange={setMoradorId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o morador" />
                </SelectTrigger>
                <SelectContent>
                  {moradores.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome} — Apto {formatApt(m.apartamento)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <BotaoSelecao opcoes={TIPOS} valor={tipo} onChange={setTipo} />
            </div>

            <div className="space-y-2">
              <Label>Origem</Label>
              <BotaoSelecao
                opcoes={[...ORIGENS_RAPIDAS, 'Outros']}
                valor={origem}
                onChange={(v) => { setOrigem(v); if (v !== 'Outros') setOrigemCustom(''); }}
              />
              {origem === 'Outros' && (
                <Input
                  className="mt-2"
                  placeholder="Digite a origem..."
                  value={origemCustom}
                  onChange={(e) => setOrigemCustom(e.target.value)}
                  autoFocus
                />
              )}
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}
            {sucesso && <p className="text-sm text-green-600 font-medium">{sucesso}</p>}

            <Button type="submit" className="w-full" disabled={registrando || !moradorId}>
              {registrando ? 'Registrando...' : 'Registrar encomenda'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Pendentes */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-medium">Pendentes</h2>
          <Badge variant="secondary">{pendentes.length}</Badge>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!loading && pendentes.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma encomenda pendente.</p>
        )}

        {pendentes.map((enc) => (
          <Card key={enc.id}>
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{enc.morador.nome}</p>
                <p className="text-sm text-muted-foreground">
                  Apto {formatApt(enc.morador.apartamento)}
                  {enc.descricao && ` · ${enc.descricao}`}
                </p>
                <p className="text-xs text-muted-foreground">{formatData(enc.createdAt)}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRetirada(enc.id)}
                className="shrink-0"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Retirada
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
