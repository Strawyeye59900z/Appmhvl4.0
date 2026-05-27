'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { moradores as moradoresApi } from '@/lib/api';

interface Morador {
  id: string;
  nome: string;
  whatsapp: string | null;
  ativo: boolean;
  apartamento: { id: string; numero: string; bloco: string | null };
}

export default function MoradoresPage() {
  const [lista, setLista] = useState<Morador[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      setLista(await moradoresApi.list());
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao carregar moradores');
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Moradores</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={carregar} title="Atualizar">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Os moradores são cadastrados pelos próprios apartamentos no primeiro acesso.
        Use a tela de <strong>Apartamentos</strong> para redefinir a senha de um apartamento.
      </p>

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!loading && erro && <p className="text-sm text-destructive">{erro}</p>}
      {!loading && !erro && lista.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum morador cadastrado.</p>
      )}

      {!loading && lista.length > 0 && (
        <>
          <span className="text-sm text-muted-foreground">
            {lista.length} {lista.length === 1 ? 'morador' : 'moradores'}
          </span>
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
        </>
      )}
    </div>
  );
}
