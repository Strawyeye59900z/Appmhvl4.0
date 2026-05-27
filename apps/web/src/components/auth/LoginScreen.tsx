'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Eye, EyeOff, UserCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { auth as authApi } from '@/lib/api';
import { saveSession, parseJwtPayload, getSession } from '@/lib/auth';
import { WhatsAppInput, formatWhatsApp, isWhatsAppValid } from '@/components/ui/whatsapp-input';

export function LoginScreen() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (session) redirectByRole(session.role);
  }, []);

  function redirectByRole(role: string) {
    if (role === 'ADMIN') router.replace('/admin');
    else if (role === 'FUNCIONARIO') router.replace('/porteiro');
    else router.replace('/me');
  }

  // ── MORADOR ────────────────────────────────────────────────────────
  const [moradorStep, setMoradorStep] = useState<'login' | 'cadastro'>('login');
  const [aptIdPrimeiroAcesso, setAptIdPrimeiroAcesso] = useState('');
  const [moradorNome, setMoradorNome] = useState('');
  const [moradorDdd, setMoradorDdd] = useState('');
  const [moradorNumero, setMoradorNumero] = useState('');
  const [cadastrandoMorador, setCadastrandoMorador] = useState(false);
  const [moradorSucesso, setMoradorSucesso] = useState('');

  async function handleMorador(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const numeroApartamento = (fd.get('numeroApt') as string).trim();
    const password = fd.get('password') as string;
    try {
      const res = await authApi.loginMorador({ numeroApartamento, password });
      if ('primeiroAcesso' in res) {
        // Busca o id pelo número — usamos o sub que vem no token de primeiroAcesso
        // Na verdade o backend retorna { primeiroAcesso: true } sem id; precisamos do id
        // Fazemos login com a senha padrão 123456 para obter o sub
        setError('');
        // Redireciona para primeiro acesso buscando o apartamento pelo número
        router.push(`/primeiro-acesso?numero=${encodeURIComponent(numeroApartamento)}`);
        return;
      }
      const payload = parseJwtPayload(res.accessToken);
      if (!payload) throw new Error('Token inválido');
      saveSession({ accessToken: res.accessToken, role: payload.role, sub: payload.sub });

      // Verifica se há moradores cadastrados — se não, abre tela de cadastro
      setAptIdPrimeiroAcesso(payload.sub);
      saveSession({ accessToken: res.accessToken, role: payload.role, sub: payload.sub });

      // Busca moradores do apt usando o token recém emitido
      const meusRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/moradores/meus`,
        { headers: { Authorization: `Bearer ${res.accessToken}` } },
      );
      const meus = meusRes.ok ? await meusRes.json() : [];

      if (meus.length === 0) {
        setAptIdPrimeiroAcesso(payload.sub);
        setMoradorStep('cadastro');
        setLoading(false);
        return;
      }

      redirectByRole(payload.role);
    } catch (err: any) {
      setError(err.message ?? 'Apartamento ou senha incorretos');
    } finally {
      setLoading(false);
    }
  }

  async function handleCadastrarMorador(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!isWhatsAppValid(moradorDdd, moradorNumero)) {
      setError('WhatsApp inválido. Preencha o DDD (2 dígitos) e o número (8 ou 9 dígitos).');
      return;
    }
    setCadastrandoMorador(true);
    try {
      const session = getSession();
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/moradores`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.accessToken}`,
          },
          body: JSON.stringify({ nome: moradorNome, whatsapp: formatWhatsApp(moradorDdd, moradorNumero) }),
        },
      );
      setMoradorSucesso(`${moradorNome} cadastrado!`);
      setMoradorNome(''); setMoradorDdd(''); setMoradorNumero('');
    } catch (err: any) {
      setError(err.message ?? 'Erro ao cadastrar morador');
    } finally {
      setCadastrandoMorador(false);
    }
  }

  // ── PORTEIRO ────────────────────────────────────────────────────────
  const [funcionarios, setFuncionarios] = useState<{ id: string; nome: string }[]>([]);
  const [funcSelecionado, setFuncSelecionado] = useState<{ id: string; nome: string } | null>(null);
  const [primeiroAcessoFunc, setPrimeiroAcessoFunc] = useState(false);
  const [novaSenhaFunc, setNovaSenhaFunc] = useState('');
  const [confirmarSenhaFunc, setConfirmarSenhaFunc] = useState('');
  const [mostrarSenhaFunc, setMostrarSenhaFunc] = useState(false);

  useEffect(() => {
    authApi.getFuncionarios().then(setFuncionarios).catch(() => {});
  }, []);

  async function handleFuncionario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!funcSelecionado) return;
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const password = fd.get('password') as string;
    try {
      const res = await authApi.loginFuncionario({ funcionarioId: funcSelecionado.id, password });
      if ('primeiroAcesso' in res) {
        setPrimeiroAcessoFunc(true);
        setLoading(false);
        return;
      }
      const payload = parseJwtPayload(res.accessToken);
      if (!payload) throw new Error('Token inválido');
      saveSession({ accessToken: res.accessToken, role: payload.role, sub: payload.sub });
      redirectByRole(payload.role);
    } catch (err: any) {
      setError(err.message ?? 'Senha incorreta');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetupFuncionario(e: React.FormEvent) {
    e.preventDefault();
    if (!funcSelecionado) return;
    setError('');
    if (novaSenhaFunc.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (novaSenhaFunc !== confirmarSenhaFunc) { setError('As senhas não coincidem.'); return; }
    setLoading(true);
    try {
      const res = await authApi.setupFuncionario({ funcionarioId: funcSelecionado.id, novaSenha: novaSenhaFunc });
      const payload = parseJwtPayload(res.accessToken);
      if (!payload) throw new Error('Token inválido');
      saveSession({ accessToken: res.accessToken, role: payload.role, sub: payload.sub });
      redirectByRole(payload.role);
    } catch (err: any) {
      setError(err.message ?? 'Erro ao definir senha');
    } finally {
      setLoading(false);
    }
  }

  // ── ADMIN ─────────────────────────────────────────────────────────
  async function handleAdmin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await authApi.loginAdmin({
        username: fd.get('username') as string,
        password: fd.get('password') as string,
      });
      const payload = parseJwtPayload(res.accessToken);
      if (!payload) throw new Error('Token inválido');
      saveSession({ accessToken: res.accessToken, role: payload.role, sub: payload.sub });
      redirectByRole(payload.role);
    } catch (err: any) {
      setError(err.message ?? 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Condomínio App</h1>
          <p className="text-sm text-muted-foreground">Selecione seu perfil para entrar</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="morador" onValueChange={() => { setError(''); setFuncSelecionado(null); setPrimeiroAcessoFunc(false); setMoradorStep('login'); }}>
              <TabsList className="w-full">
                <TabsTrigger value="morador" className="flex-1">Morador</TabsTrigger>
                <TabsTrigger value="funcionario" className="flex-1">Porteiro</TabsTrigger>
                <TabsTrigger value="admin" className="flex-1">Admin</TabsTrigger>
              </TabsList>

              {/* ── MORADOR ─────────────────────────────────────────── */}
              <TabsContent value="morador">
                {moradorStep === 'login' ? (
                  <form onSubmit={handleMorador} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="numeroApt">Número do apartamento</Label>
                      <Input
                        id="numeroApt"
                        name="numeroApt"
                        placeholder="Ex: 101"
                        required
                        autoComplete="username"
                        onChange={() => setError('')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apt-password">Senha</Label>
                      <Input
                        id="apt-password"
                        name="password"
                        type="password"
                        required
                        autoComplete="current-password"
                        onChange={() => setError('')}
                      />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Entrando...' : 'Entrar'}
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground text-center pt-2">
                      Nenhum morador cadastrado neste apartamento. Cadastre os moradores agora.
                    </p>
                    <form onSubmit={handleCadastrarMorador} className="space-y-3">
                      <div className="space-y-2">
                        <Label>Nome do morador</Label>
                        <Input
                          placeholder="Nome completo"
                          value={moradorNome}
                          onChange={(e) => setMoradorNome(e.target.value)}
                          required
                        />
                      </div>
                      <WhatsAppInput
                        ddd={moradorDdd}
                        numero={moradorNumero}
                        onDddChange={(v) => { setMoradorDdd(v); setError(''); }}
                        onNumeroChange={(v) => { setMoradorNumero(v); setError(''); }}
                        required
                      />
                      {error && <p className="text-sm text-destructive">{error}</p>}
                      {moradorSucesso && <p className="text-sm text-green-600">{moradorSucesso}</p>}
                      <div className="flex gap-2">
                        <Button type="submit" className="flex-1" disabled={cadastrandoMorador || !moradorNome.trim()}>
                          {cadastrandoMorador ? 'Salvando...' : 'Adicionar morador'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => redirectByRole('MORADOR')}
                        >
                          Concluir
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </TabsContent>

              {/* ── PORTEIRO ─────────────────────────────────────────── */}
              <TabsContent value="funcionario">
                {!funcSelecionado ? (
                  <div className="space-y-3 pt-2">
                    <p className="text-sm text-muted-foreground">Selecione seu nome:</p>
                    {funcionarios.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum porteiro cadastrado.
                      </p>
                    )}
                    <div className="space-y-2">
                      {funcionarios.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => { setFuncSelecionado(f); setError(''); }}
                          className="w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          <UserCircle2 className="h-8 w-8 text-muted-foreground shrink-0" />
                          <span>{f.nome}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : primeiroAcessoFunc ? (
                  <form onSubmit={handleSetupFuncionario} className="space-y-4">
                    <div className="flex items-center gap-2 pt-2">
                      <UserCircle2 className="h-6 w-6 text-muted-foreground" />
                      <span className="font-medium">{funcSelecionado.nome}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Primeiro acesso — crie sua senha:
                    </p>
                    <div className="space-y-2">
                      <Label>Nova senha</Label>
                      <div className="relative">
                        <Input
                          type={mostrarSenhaFunc ? 'text' : 'password'}
                          placeholder="Mínimo 6 caracteres"
                          value={novaSenhaFunc}
                          onChange={(e) => { setNovaSenhaFunc(e.target.value); setError(''); }}
                          required
                          autoFocus
                          className="pr-10"
                        />
                        <button type="button" onClick={() => setMostrarSenhaFunc((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {mostrarSenhaFunc ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmar senha</Label>
                      <Input
                        type={mostrarSenhaFunc ? 'text' : 'password'}
                        placeholder="Repita a senha"
                        value={confirmarSenhaFunc}
                        onChange={(e) => { setConfirmarSenhaFunc(e.target.value); setError(''); }}
                        required
                      />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => { setFuncSelecionado(null); setPrimeiroAcessoFunc(false); }}>
                        Voltar
                      </Button>
                      <Button type="submit" className="flex-1" disabled={loading}>
                        {loading ? 'Salvando...' : 'Definir senha e entrar'}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleFuncionario} className="space-y-4">
                    <div className="flex items-center gap-2 pt-2">
                      <UserCircle2 className="h-6 w-6 text-muted-foreground" />
                      <span className="font-medium">{funcSelecionado.nome}</span>
                      <button type="button" onClick={() => { setFuncSelecionado(null); setError(''); }}
                        className="ml-auto text-xs text-muted-foreground underline">
                        Trocar
                      </button>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="func-password">Senha</Label>
                      <Input
                        id="func-password"
                        name="password"
                        type="password"
                        required
                        autoFocus
                        autoComplete="current-password"
                        onChange={() => setError('')}
                      />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Entrando...' : 'Entrar'}
                    </Button>
                  </form>
                )}
              </TabsContent>

              {/* ── ADMIN ─────────────────────────────────────────────── */}
              <TabsContent value="admin">
                <form onSubmit={handleAdmin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Usuário</Label>
                    <Input
                      id="username"
                      name="username"
                      placeholder="admin"
                      required
                      autoComplete="username"
                      onChange={() => setError('')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      autoComplete="current-password"
                      onChange={() => setError('')}
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Entrando...' : 'Entrar'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
