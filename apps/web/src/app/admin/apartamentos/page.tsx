'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apartamentos as apartamentosApi } from '@/lib/api';

interface Apartamento {
  id: string;
  numero: string;
  bloco: string | null;
  ativo: boolean;
  _count?: { moradores: number };
}

export default function ApartamentosPage() {
  const [lista, setLista] = useState<Apartamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [numero, setNumero] = useState('');
  const [bloco, setBloco] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apartamentosApi.list();
      setLista(data);
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
    setCriando(true);
    try {
      await apartamentosApi.create({ numero, bloco: bloco || undefined });
      setSucesso(`Apartamento ${bloco ? `${bloco} - ` : ''}${numero} criado.`);
      setNumero(''); setBloco('');
      await carregar();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao criar apartamento');
    } finally {
      setCriando(false);
    }
  }

  async function handleRemover(id: string, label: string) {
    if (!confirm(`Remover apartamento "${label}"?`)) return;
    setErro('');
    try {
      await apartamentosApi.remove(id);
      await carregar();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao remover apartamento');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Apartamentos</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo apartamento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCriar} className="flex items-end gap-3 flex-wrap">
            <div className="space-y-2 w-28">
              <Label htmlFor="bloco">Bloco (opcional)</Label>
              <Input id="bloco" placeholder="A" value={bloco} onChange={(e) => setBloco(e.target.value)} />
            </div>
            <div className="space-y-2 w-32">
              <Label htmlFor="numero">Número</Label>
              <Input id="numero" placeholder="101" value={numero} onChange={(e) => setNumero(e.target.value)} required />
            </div>
            <Button type="submit" disabled={criando || !numero.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              {criando ? 'Criando...' : 'Criar'}
            </Button>
          </form>
          {erro && <p className="text-sm text-destructive mt-3">{erro}</p>}
          {sucesso && <p className="text-sm text-green-600 mt-3">{sucesso}</p>}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {lista.length} {lista.length === 1 ? 'apartamento' : 'apartamentos'}
        </span>
        <Button variant="ghost" size="icon" onClick={carregar} title="Atualizar">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!loading && lista.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum apartamento cadastrado.</p>
      )}

      {!loading && lista.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Apartamento</th>
                <th className="text-left px-4 py-3 font-medium">Moradores</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.map((a) => {
                const label = a.bloco ? `${a.bloco} - ${a.numero}` : a.numero;
                return (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{label}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a._count?.moradores ?? 0}</td>
                    <td className="px-4 py-3">
                      <Badge variant={a.ativo ? 'secondary' : 'outline'}>
                        {a.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemover(a.id, label)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
