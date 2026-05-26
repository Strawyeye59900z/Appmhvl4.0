'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserCog, Plus, Trash2, RotateCcw, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { funcionarios as funcionariosApi } from '@/lib/api';

interface Funcionario {
  id: string;
  nome: string;
  ativo: boolean;
  primeiroAcesso: boolean;
  createdAt: string;
}

export default function FuncionariosPage() {
  const [lista, setLista] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // estado do modal de senha
  const [senhaModal, setSenhaModal] = useState<{ id: string; nome: string } | null>(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await funcionariosApi.list();
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
      await funcionariosApi.create({ nome });
      setSucesso(`Funcionário "${nome}" criado. Defina uma senha clicando no ícone de chave.`);
      setNome('');
      await carregar();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao criar funcionário');
    } finally {
      setCriando(false);
    }
  }

  async function handleDefinirSenha(e: React.FormEvent) {
    e.preventDefault();
    if (!senhaModal) return;
    setErroSenha('');
    setSalvandoSenha(true);
    try {
      await funcionariosApi.resetSenha(senhaModal.id, novaSenha);
      setSenhaModal(null);
      setNovaSenha('');
      setSucesso(`Senha de "${senhaModal.nome}" definida com sucesso.`);
      await carregar();
    } catch (err: any) {
      setErroSenha(err.message ?? 'Erro ao definir senha');
    } finally {
      setSalvandoSenha(false);
    }
  }

  async function handleRemover(id: string, nomeFuncionario: string) {
    if (!confirm(`Remover funcionário "${nomeFuncionario}"?`)) return;
    setErro('');
    try {
      await funcionariosApi.remove(id);
      await carregar();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao remover funcionário');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserCog className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Funcionários</h1>
      </div>

      {/* Formulário de cadastro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo funcionário</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCriar} className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                placeholder="Nome do funcionário"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={criando || !nome.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              {criando ? 'Criando...' : 'Criar'}
            </Button>
          </form>
          {erro && <p className="text-sm text-destructive mt-3">{erro}</p>}
          {sucesso && <p className="text-sm text-green-600 mt-3">{sucesso}</p>}
        </CardContent>
      </Card>

      {/* Modal de definir senha */}
      {senhaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-full max-w-sm mx-4">
            <CardHeader>
              <CardTitle className="text-base">Definir senha — {senhaModal.nome}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDefinirSenha} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nova-senha">Nova senha (mín. 6 caracteres)</Label>
                  <Input
                    id="nova-senha"
                    type="password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    required
                    minLength={6}
                    autoFocus
                  />
                </div>
                {erroSenha && <p className="text-sm text-destructive">{erroSenha}</p>}
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setSenhaModal(null); setNovaSenha(''); setErroSenha(''); }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={salvandoSenha || novaSenha.length < 6}>
                    {salvandoSenha ? 'Salvando...' : 'Salvar senha'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lista */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {lista.length} {lista.length === 1 ? 'funcionário' : 'funcionários'}
        </span>
        <Button variant="ghost" size="icon" onClick={carregar} title="Atualizar">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!loading && lista.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum funcionário cadastrado.</p>
      )}

      {!loading && lista.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nome</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Cadastrado em</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.map((f) => (
                <tr key={f.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{f.nome}</td>
                  <td className="px-4 py-3">
                    {f.primeiroAcesso ? (
                      <Badge variant="outline">Sem senha</Badge>
                    ) : (
                      <Badge variant="secondary">Ativo</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {new Date(f.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setSenhaModal({ id: f.id, nome: f.nome }); setErroSenha(''); setNovaSenha(''); }}
                        title="Definir senha"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemover(f.id, f.nome)}
                        className="text-destructive hover:text-destructive"
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
