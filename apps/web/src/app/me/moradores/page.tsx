'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { WhatsAppInput, formatWhatsApp, isWhatsAppValid } from '@/components/ui/whatsapp-input';
import { moradores as moradoresApi } from '@/lib/api';

interface Morador {
  id: string;
  nome: string;
  whatsapp: string | null;
}

export default function MeusMoradoresPage() {
  const [lista, setLista] = useState<Morador[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [ddd, setDdd] = useState('');
  const [numero, setNumero] = useState('');
  const [criando, setCriando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const carregar = useCallback(async () => {
    try {
      setLista(await moradoresApi.meus());
    } catch {
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setSucesso('');
    if (!isWhatsAppValid(ddd, numero)) {
      setErro('WhatsApp inválido. Preencha o DDD (2 dígitos) e o número (8 ou 9 dígitos).');
      return;
    }
    setCriando(true);
    try {
      await moradoresApi.create({ nome, whatsapp: formatWhatsApp(ddd, numero) });
      setSucesso(`${nome} adicionado.`);
      setNome(''); setDdd(''); setNumero('');
      await carregar();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao cadastrar morador');
    } finally {
      setCriando(false);
    }
  }

  async function handleRemover(id: string, nomeMorador: string) {
    if (!confirm(`Remover ${nomeMorador}?`)) return;
    setErro(''); setSucesso('');
    setRemovendo(id);
    try {
      await moradoresApi.remove(id);
      await carregar();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao remover morador');
    } finally {
      setRemovendo(null);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3 pt-2">
        <Users className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Moradores do apartamento</h1>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <form onSubmit={handleCriar} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                placeholder="Nome completo"
                value={nome}
                onChange={(e) => { setNome(e.target.value); setErro(''); }}
                required
              />
            </div>
            <WhatsAppInput
              ddd={ddd}
              numero={numero}
              onDddChange={(v) => { setDdd(v); setErro(''); }}
              onNumeroChange={(v) => { setNumero(v); setErro(''); }}
              required
            />
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}
            <Button type="submit" className="w-full" disabled={criando || !nome.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              {criando ? 'Adicionando...' : 'Adicionar morador'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {!loading && lista.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nenhum morador cadastrado ainda.</p>
        </div>
      )}

      {lista.length > 0 && (
        <div className="space-y-2">
          {lista.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{m.nome}</p>
                  {m.whatsapp && (
                    <p className="text-xs text-muted-foreground">{m.whatsapp}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={removendo === m.id}
                  onClick={() => handleRemover(m.id, m.nome)}
                  className="text-destructive hover:text-destructive shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
