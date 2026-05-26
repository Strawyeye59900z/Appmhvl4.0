'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { moradores as moradoresApi, apartamentos as apartamentosApi } from '@/lib/api';

interface Apartamento { id: string; numero: string; bloco: string | null }
interface Morador {
  id: string;
  nome: string;
  whatsapp: string | null;
  cpf: string | null;
  ativo: boolean;
  apartamento: { id: string; numero: string; bloco: string | null };
}

export default function MoradoresPage() {
  const [lista, setLista] = useState<Morador[]>([]);
  const [apts, setApts] = useState<Apartamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [apartamentoId, setApartamentoId] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const [m, a] = await Promise.all([moradoresApi.list(), apartamentosApi.list()]);
      setLista(m);
      setApts(a);
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao carregar moradores');
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setSucesso('');
    setCriando(true);
    try {
      await moradoresApi.create({ nome, apartamentoId, whatsapp: whatsapp || undefined });
      setSucesso(`Morador "${nome}" cadastrado.`);
      setNome(''); setWhatsapp(''); setApartamentoId('');
      await carregar();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao cadastrar morador');
    } finally {
      setCriando(false);
    }
  }

  async function handleRemover(id: string, nomeMorador: string) {
    if (!confirm(`Remover morador "${nomeMorador}"?`)) return;
    setErro('');
    try {
      await moradoresApi.remove(id);
      await carregar();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao remover morador');
    }
  }

  function formatApt(apt: { numero: string; bloco: string | null }) {
    return apt.bloco ? `${apt.bloco} - ${apt.numero}` : apt.numero;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Moradores</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo morador</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCriar} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Apartamento</Label>
                <Select value={apartamentoId} onValueChange={setApartamentoId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o apartamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {apts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{formatApt(a)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp (opcional)</Label>
                <Input id="whatsapp" placeholder="11999990000" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
              </div>
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            {sucesso && <p className="text-sm text-green-600">{sucesso}</p>}
            <Button type="submit" disabled={criando || !nome.trim() || !apartamentoId}>
              <Plus className="h-4 w-4 mr-1" />
              {criando ? 'Cadastrando...' : 'Cadastrar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {lista.length} {lista.length === 1 ? 'morador' : 'moradores'}
        </span>
        <Button variant="ghost" size="icon" onClick={carregar} title="Atualizar">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!loading && erro && lista.length === 0 && (
        <p className="text-sm text-destructive">{erro}</p>
      )}
      {!loading && !erro && lista.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum morador cadastrado.</p>
      )}

      {!loading && lista.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nome</th>
                <th className="text-left px-4 py-3 font-medium">Apartamento</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">WhatsApp</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.map((m) => (
                <tr key={m.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{m.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatApt(m.apartamento)}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{m.whatsapp ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemover(m.id, m.nome)}
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
