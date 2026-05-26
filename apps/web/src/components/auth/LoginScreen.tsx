'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { auth as authApi } from '@/lib/api';
import { saveSession, parseJwtPayload, getSession } from '@/lib/auth';

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

  // ── MORADOR ─────────────────────────────────────────────────────
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
        setErro('Apartamento sem senha configurada. Contate o administrador.');
        return;
      }
      const payload = parseJwtPayload(res.accessToken);
      if (!payload) throw new Error('Token inválido');
      saveSession({ accessToken: res.accessToken, role: payload.role, sub: payload.sub });
      redirectByRole(payload.role);
    } catch (err: any) {
      setError(err.message ?? 'Apartamento ou senha incorretos');
    } finally {
      setLoading(false);
    }
  }

  // ── FUNCIONÁRIO ──────────────────────────────────────────────────
  const [funcionarios, setFuncionarios] = useState<{ id: string; nome: string }[]>([]);
  const [primeiroAcessoFunc, setPrimeiroAcessoFunc] = useState(false);

  useEffect(() => {
    authApi.getFuncionarios().then(setFuncionarios).catch(() => {});
  }, []);

  async function handleFuncionario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const nomeDigitado = (fd.get('nomeFuncionario') as string).trim().toLowerCase();
    const password = fd.get('password') as string;
    try {
      // Busca pelo nome (case-insensitive) na lista já carregada
      const func = funcionarios.find((f) => f.nome.toLowerCase() === nomeDigitado);
      if (!func) throw new Error('Funcionário não encontrado');
      const res = await authApi.loginFuncionario({ funcionarioId: func.id, password });
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
      setError(err.message ?? 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  // ── ADMIN ────────────────────────────────────────────────────────
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
            <Tabs defaultValue="morador">
              <TabsList className="w-full">
                <TabsTrigger value="morador" className="flex-1">Morador</TabsTrigger>
                <TabsTrigger value="funcionario" className="flex-1">Porteiro</TabsTrigger>
                <TabsTrigger value="admin" className="flex-1">Admin</TabsTrigger>
              </TabsList>

              {/* Morador */}
              <TabsContent value="morador">
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
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Entrando...' : 'Entrar'}
                  </Button>
                </form>
              </TabsContent>

              {/* Funcionário */}
              <TabsContent value="funcionario">
                {primeiroAcessoFunc ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Primeiro acesso detectado. Entre em contato com o administrador para definir sua senha.
                  </p>
                ) : (
                  <form onSubmit={handleFuncionario} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="nomeFuncionario">Nome</Label>
                      <Input
                        id="nomeFuncionario"
                        name="nomeFuncionario"
                        placeholder="Digite seu nome completo"
                        required
                        autoComplete="username"
                        onChange={() => setError('')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="func-password">Senha</Label>
                      <Input
                        id="func-password"
                        name="password"
                        type="password"
                        required
                        autoComplete="current-password"
                      />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Entrando...' : 'Entrar'}
                    </Button>
                  </form>
                )}
              </TabsContent>

              {/* Admin */}
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
