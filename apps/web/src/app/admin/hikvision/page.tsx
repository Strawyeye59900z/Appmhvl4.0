'use client';

import { useState, useEffect, useCallback } from 'react';
import { Monitor, Plus, Wifi, WifiOff, RefreshCw, Trash2, RotateCcw, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hikvision as hikvisionApi } from '@/lib/api';
import { getSession } from '@/lib/auth';

// ── Types ──────────────────────────────────────────────────────────────────

interface Terminal {
  id: string;
  nome: string;
  host: string;
  porta: number;
  username: string;
  ativo: boolean;
  ultimoPing: string | null;
  ultimoStatus: string | null;
}

interface SyncEntry {
  id: string;
  nome: string;
  tipo: 'MORADOR' | 'FUNCIONARIO' | 'VISITANTE';
  tipoVisitante?: 'PERSONAL' | 'FUNCIONARIO_TEMP';
  apto: string | null;
  fotoUrl: string | null;
  validoAte?: string;
  moradorNome?: string;
  statusGeral: string;
  syncs: { terminalId: string; terminalNome: string; status: string; tentativas: number; ultimoErro: string | null }[];
}

// ── Status badge helper ───────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  OK:              { label: 'OK',        className: 'bg-green-100 text-green-800 border border-green-300' },
  PENDENTE:        { label: 'Pendente',  className: 'bg-yellow-100 text-yellow-800 border border-yellow-300' },
  EM_FILA:         { label: 'Na fila',   className: 'bg-blue-100 text-blue-800 border border-blue-300' },
  ENVIANDO:        { label: 'Enviando',  className: 'bg-blue-100 text-blue-800 border border-blue-300' },
  FALHOU:          { label: 'Falha',     className: 'bg-red-100 text-red-800 border border-red-300' },
  PARCIALMENTE_OK: { label: 'Parcial',   className: 'bg-orange-100 text-orange-800 border border-orange-300' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-800 border' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function HikvisionPage() {
  const [aba, setAba] = useState<'terminais' | 'sync' | 'reupload'>('terminais');
  const [terminais, setTerminais] = useState<Terminal[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncEntry[]>([]);
  const [loadingTerminais, setLoadingTerminais] = useState(true);
  const [loadingSync, setLoadingSync] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<'TODOS' | 'MORADOR' | 'FUNCIONARIO' | 'VISITANTE'>('TODOS');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Terminal | null>(null);

  // Reupload state
  const [carregandoReupload, setCarregandoReupload] = useState(false);
  const [resultadoReupload, setResultadoReupload] = useState<{ tipo: string; mensagem: string } | null>(null);

  const [nome, setNome] = useState('');
  const [host, setHost] = useState('');
  const [porta, setPorta] = useState('80');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  const carregarTerminais = useCallback(async () => {
    setLoadingTerminais(true);
    try { setTerminais(await hikvisionApi.terminais.list()); }
    catch { setTerminais([]); }
    finally { setLoadingTerminais(false); }
  }, []);

  const carregarSync = useCallback(async () => {
    setLoadingSync(true);
    try { setSyncStatus(await hikvisionApi.syncStatus()); }
    catch { setSyncStatus([]); }
    finally { setLoadingSync(false); }
  }, []);

  useEffect(() => { carregarTerminais(); carregarSync(); }, [carregarTerminais, carregarSync]);

  useEffect(() => {
    const emAndamento = syncStatus.some((s) =>
      s.syncs.some((sy) => ['PENDENTE', 'EM_FILA', 'ENVIANDO'].includes(sy.status))
    );
    if (!emAndamento) return;
    const t = setTimeout(carregarSync, 30000);
    return () => clearTimeout(t);
  }, [syncStatus, carregarSync]);

  function abrirCriar() {
    setEditando(null);
    setNome(''); setHost(''); setPorta('80'); setUsername(''); setPassword('');
    setErroForm('');
    setModalAberto(true);
  }

  function abrirEditar(t: Terminal) {
    setEditando(t);
    setNome(t.nome); setHost(t.host); setPorta(String(t.porta)); setUsername(t.username); setPassword('');
    setErroForm('');
    setModalAberto(true);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setErroForm('');
    setSalvando(true);
    try {
      if (editando) {
        const body: Record<string, unknown> = { nome, host, porta: Number(porta), username };
        if (password) body.password = password;
        await hikvisionApi.terminais.update(editando.id, body);
      } else {
        await hikvisionApi.terminais.create({ nome, host, porta: Number(porta), username, password });
      }
      setModalAberto(false);
      await carregarTerminais();
    } catch (err: any) {
      setErroForm(err.message ?? 'Erro ao salvar terminal');
    } finally {
      setSalvando(false);
    }
  }

  async function handlePing(id: string) {
    await hikvisionApi.terminais.ping(id);
    await carregarTerminais();
  }

  async function handleRemover(id: string, nomeTerminal: string) {
    if (!confirm(`Remover terminal "${nomeTerminal}"?`)) return;
    await hikvisionApi.terminais.remove(id);
    await carregarTerminais();
  }

  async function handleRetry(pessoaId: string, tipo: 'MORADOR' | 'FUNCIONARIO' | 'VISITANTE') {
    await hikvisionApi.retry(pessoaId, tipo);
    await carregarSync();
  }

  async function handleReuploadTodos() {
    if (!confirm('Isso vai reenviar TODOS os cadastros com foto para todos os terminais. Continuar?')) return;
    setCarregandoReupload(true);
    setResultadoReupload(null);
    try {
      const session = getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/hikvision/reupload/todos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.accessToken}` },
      });
      const data = await res.json();
      setResultadoReupload({
        tipo: 'sucesso',
        mensagem: `✓ ${data.enfileirados} cadastros enfileirados para sincronização`,
      });
      await carregarSync();
    } catch (err: any) {
      setResultadoReupload({ tipo: 'erro', mensagem: err.message ?? 'Erro ao processar reupload' });
    } finally {
      setCarregandoReupload(false);
    }
  }

  async function handleReuploadFalhas() {
    if (!confirm('Isso vai reenviar apenas os cadastros que falharam. Continuar?')) return;
    setCarregandoReupload(true);
    setResultadoReupload(null);
    try {
      const session = getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/hikvision/reupload/falhas`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.accessToken}` },
      });
      const data = await res.json();
      setResultadoReupload({
        tipo: 'sucesso',
        mensagem: `✓ ${data.enfileirados} cadastros com falha enfileirados`,
      });
      await carregarSync();
    } catch (err: any) {
      setResultadoReupload({ tipo: 'erro', mensagem: err.message ?? 'Erro ao processar reupload de falhas' });
    } finally {
      setCarregandoReupload(false);
    }
  }

  async function handleReuploadFalhasComDelete() {
    if (!confirm('Isso vai deletar e reenviar os cadastros que falharam dos terminais. Continuar?')) return;
    setCarregandoReupload(true);
    setResultadoReupload(null);
    try {
      const session = getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/hikvision/reupload/falhas-com-delete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.accessToken}` },
      });
      const data = await res.json();
      setResultadoReupload({
        tipo: 'sucesso',
        mensagem: `✓ ${data.deletados} cadastros deletados, ${data.enfileirados} reenviados`,
      });
      await carregarSync();
    } catch (err: any) {
      setResultadoReupload({ tipo: 'erro', mensagem: err.message ?? 'Erro ao processar reupload com delete' });
    } finally {
      setCarregandoReupload(false);
    }
  }

  const STATUS_ORDER: Record<string, number> = {
    PENDENTE: 0, EM_FILA: 0, ENVIANDO: 0, FALHOU: 1, PARCIALMENTE_OK: 2, OK: 3,
  };

  const syncFiltrado = syncStatus
    .filter((s) => filtroTipo === 'TODOS' || s.tipo === filtroTipo)
    .sort((a, b) => {
      const oa = STATUS_ORDER[a.statusGeral] ?? 4;
      const ob = STATUS_ORDER[b.statusGeral] ?? 4;
      if (oa !== ob) return oa - ob;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Monitor className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Hikvision</h1>
      </div>

      {/* Tabs manuais */}
      <div className="border-b flex gap-0">
        <button
          onClick={() => setAba('terminais')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            aba === 'terminais' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Terminais
        </button>
        <button
          onClick={() => setAba('sync')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            aba === 'sync' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Sincronização
        </button>
        <button
          onClick={() => setAba('reupload')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            aba === 'reupload' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Reupload
        </button>
      </div>

      {/* Aba Terminais */}
      {aba === 'terminais' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{terminais.length} terminal(is) configurado(s)</p>
            <Button onClick={abrirCriar} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar terminal
            </Button>
          </div>

          {loadingTerminais && <p className="text-sm text-muted-foreground">Carregando...</p>}

          <div className="grid gap-4 md:grid-cols-2">
            {terminais.map((t) => (
              <div key={t.id} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.nome}</span>
                  {t.ultimoStatus === 'ok' ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 border border-green-300 bg-green-50 rounded px-2 py-0.5">
                      <Wifi className="h-3 w-3" /> Online
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-red-700 border border-red-300 bg-red-50 rounded px-2 py-0.5">
                      <WifiOff className="h-3 w-3" />
                      {t.ultimoStatus ?? 'Não testado'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground font-mono">{t.host}:{t.porta}</p>
                {t.ultimoPing && (
                  <p className="text-xs text-muted-foreground">
                    Último ping: {new Date(t.ultimoPing).toLocaleString('pt-BR')}
                  </p>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => handlePing(t.id)}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Testar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => abrirEditar(t)}>
                    <Pencil className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleRemover(t.id, t.nome)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aba Sincronização */}
      {aba === 'sync' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 flex-wrap">
              {(['TODOS', 'MORADOR', 'FUNCIONARIO', 'VISITANTE'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltroTipo(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                    filtroTipo === f
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-input hover:bg-muted'
                  }`}
                >
                  {f === 'TODOS' ? 'Todos' : f === 'MORADOR' ? 'Moradores' : f === 'FUNCIONARIO' ? 'Funcionários' : 'Visitantes'}
                  {' '}
                  <span className="opacity-70">
                    ({f === 'TODOS' ? syncStatus.length : syncStatus.filter((s) => s.tipo === f).length})
                  </span>
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={carregarSync}>
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
            </Button>
          </div>

          {loadingSync && <p className="text-sm text-muted-foreground">Carregando...</p>}

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Nome</th>
                  <th className="text-left p-3 font-medium">Tipo</th>
                  <th className="text-left p-3 font-medium">Apto</th>
                  <th className="text-left p-3 font-medium">Válido até</th>
                  <th className="text-left p-3 font-medium">Status Geral</th>
                  {terminais.map((t) => (
                    <th key={t.id} className="text-left p-3 font-medium">{t.nome}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {syncFiltrado.map((pessoa) => (
                  <tr key={pessoa.id} className="border-b hover:bg-muted/20">
                    <td className="p-3 font-medium">{pessoa.nome}</td>
                    <td className="p-3 text-muted-foreground">
                      {pessoa.tipo === 'MORADOR' ? 'Morador'
                       : pessoa.tipo === 'FUNCIONARIO' ? 'Porteiro'
                       : pessoa.tipoVisitante === 'PERSONAL' ? 'Personal'
                       : 'Func. Temp'}
                    </td>
                    <td className="p-3 text-muted-foreground">{pessoa.apto ?? '—'}</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {pessoa.validoAte ? new Date(pessoa.validoAte).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="p-3"><StatusBadge status={pessoa.statusGeral} /></td>
                    {terminais.map((t) => {
                      const sync = pessoa.syncs.find((s) => s.terminalId === t.id);
                      return (
                        <td key={t.id} className="p-3">
                          <div className="flex items-center gap-1">
                            {sync ? <StatusBadge status={sync.status} /> : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                            {sync?.status !== 'OK' && (
                              <button
                                className="p-1 rounded hover:bg-muted"
                                onClick={() => handleRetry(pessoa.id, pessoa.tipo)}
                                title={sync?.ultimoErro ?? 'Enviar para este terminal'}
                              >
                                <RotateCcw className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {!loadingSync && syncStatus.length === 0 && (
                  <tr>
                    <td colSpan={4 + terminais.length} className="p-6 text-center text-muted-foreground">
                      Nenhum morador ou porteiro com foto cadastrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Aba Reupload */}
      {aba === 'reupload' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Reupload de cadastros</h3>
            <p className="text-sm text-blue-800">
              Use as opções abaixo para reenviar cadastros para os terminais Hikvision.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <button
              onClick={handleReuploadTodos}
              disabled={carregandoReupload}
              className="flex flex-col gap-3 p-6 rounded-lg border hover:border-primary hover:bg-primary/5 transition-all text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Reenviar Todos</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Reenvia TODOS os cadastros com foto para todos os terminais. Útil para fazer upload de fotos novas.
              </p>
            </button>

            <button
              onClick={handleReuploadFalhas}
              disabled={carregandoReupload}
              className="flex flex-col gap-3 p-6 rounded-lg border hover:border-orange-300 hover:bg-orange-50 transition-all text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-orange-600" />
                <span className="font-medium">Reenviar Falhas</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Reenvia apenas os cadastros que falharam na sincronização.
              </p>
            </button>

            <button
              onClick={handleReuploadFalhasComDelete}
              disabled={carregandoReupload}
              className="flex flex-col gap-3 p-6 rounded-lg border hover:border-red-300 hover:bg-red-50 transition-all text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-red-600" />
                <span className="font-medium">Delete + Reupload</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Deleta os cadastros que falharam dos terminais e reenvia. Use se o facial fica corrompido.
              </p>
            </button>
          </div>

          {resultadoReupload && (
            <div className={`rounded-lg border p-4 ${
              resultadoReupload.tipo === 'sucesso'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <p className={`text-sm ${resultadoReupload.tipo === 'sucesso' ? 'text-green-700' : 'text-red-700'}`}>
                {resultadoReupload.mensagem}
              </p>
            </div>
          )}

          {carregandoReupload && (
            <div className="flex items-center justify-center p-8">
              <p className="text-muted-foreground">Processando reupload...</p>
            </div>
          )}
        </div>
      )}

      {/* Modal criar/editar terminal */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalAberto(false)} />
          <div className="relative bg-background rounded-xl border shadow-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold">{editando ? 'Editar terminal' : 'Adicionar terminal'}</h2>
            <form onSubmit={handleSalvar} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input placeholder="Portaria Principal" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1.5">
                  <Label>IP / Host</Label>
                  <Input placeholder="192.168.1.50" value={host} onChange={(e) => setHost(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Porta</Label>
                  <Input type="number" value={porta} onChange={(e) => setPorta(e.target.value)} min={1} max={65535} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Usuário</Label>
                <Input placeholder="admin" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>{editando ? 'Nova senha (deixe vazio para manter)' : 'Senha'}</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={!editando}
                  placeholder={editando ? '••••••••' : ''}
                />
              </div>
              {erroForm && <p className="text-sm text-destructive">{erroForm}</p>}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
                <Button type="submit" disabled={salvando}>
                  {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Adicionar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
