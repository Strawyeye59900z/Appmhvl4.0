'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function PorteiroPage() {
  const [moradores, setMoradores] = useState<Morador[]>([]);
  const [pendentes, setPendentes] = useState<Encomenda[]>([]);
  const [moradorId, setMoradorId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const carregarPendentes = useCallback(async () => {
    try {
      const data = await encomendasApi.pendentes();
      setPendentes(data);
    } catch {
      // ignora — exibe lista vazia
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      moradoresApi.list().then(setMoradores).catch(() => {}),
      carregarPendentes(),
    ]).finally(() => setLoading(false));
  }, [carregarPendentes]);

  async function handleRegistrar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setRegistrando(true);
    try {
      await encomendasApi.criar({ moradorId, descricao: descricao || undefined });
      setSucesso('Encomenda registrada com sucesso!');
      setMoradorId('');
      setDescricao('');
      await carregarPendentes();
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

      {/* Formulário de registro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registrar encomenda</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegistrar} className="space-y-4">
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
              <Label htmlFor="descricao">Descrição (opcional)</Label>
              <Input
                id="descricao"
                placeholder="Ex: caixa grande, Amazon..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}
            {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}

            <Button type="submit" disabled={registrando || !moradorId}>
              {registrando ? 'Registrando...' : 'Registrar encomenda'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Lista de pendentes */}
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
