'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { auth as authApi } from '@/lib/api';
import { saveSession, parseJwtPayload, getSession } from '@/lib/auth';

export function LoginScreen() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redireciona se já autenticado
  useEffect(() => {
    const session = getSession();
    if (session) redirectByRole(session.role);
  }, []);

  function redirectByRole(role: string) {
    if (role === 'ADMIN') router.replace('/admin');
    else if (role === 'FUNCIONARIO') router.replace('/porteiro');
    else router.replace('/me');
  }

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

  // Estado para login funcionário
  const [funcionarios, setFuncionarios] = useState<{ id: string; nome: string }[]>([]);
  const [funcId, setFuncId] = useState('');
  const [primeiroAcessoFunc, setPrimeiroAcessoFunc] = useState(false);

  useEffect(() => {
    authApi.getFuncionarios().then(setFuncionarios).catch(() => {});
  }, []);

  async function handleFuncionario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await authApi.loginFuncionario({
        funcionarioId: funcId,
        password: fd.get('password') as string,
      });
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

  // Estado para login morador
  const [apartamentos, setApartamentos] = useState<{ id: string; numero: string; bloco?: string }[]>([]);
  const [aptId, setAptId] = useState('');

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/apartamentos`, {
      headers: { Authorization: 'Bearer ' },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) => setApartamentos(data))
      .catch(() => {});
  }, []);

  async function handleMorador(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await authApi.loginMorador({
        apartamentoId: aptId,
        password: fd.get('password') as string,
      });
      if ('primeiroAcesso' in res) {
        router.push(`/primeiro-acesso?tipo=morador&id=${aptId}`);
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
            <Tabs defaultValue="admin">
              <TabsList className="w-full">
                <TabsTrigger value="admin" className="flex-1">Admin</TabsTrigger>
                <TabsTrigger value="funcionario" className="flex-1">Porteiro</TabsTrigger>
                <TabsTrigger value="morador" className="flex-1">Morador</TabsTrigger>
              </TabsList>

              {/* Admin */}
              <TabsContent value="admin">
                <form onSubmit={handleAdmin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Usuário</Label>
                    <Input id="username" name="username" placeholder="admin" required autoComplete="username" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input id="password" name="password" type="password" required autoComplete="current-password" />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Entrando...' : 'Entrar como Admin'}
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
                      <Label>Funcionário</Label>
                      <Select value={funcId} onValueChange={setFuncId} required>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione seu nome" />
                        </SelectTrigger>
                        <SelectContent>
                          {funcionarios.map((f) => (
                            <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="func-password">Senha</Label>
                      <Input id="func-password" name="password" type="password" required />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" className="w-full" disabled={loading || !funcId}>
                      {loading ? 'Entrando...' : 'Entrar como Porteiro'}
                    </Button>
                  </form>
                )}
              </TabsContent>

              {/* Morador */}
              <TabsContent value="morador">
                <form onSubmit={handleMorador} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Apartamento</Label>
                    <Select value={aptId} onValueChange={setAptId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione seu apartamento" />
                      </SelectTrigger>
                      <SelectContent>
                        {apartamentos.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.bloco ? `${a.bloco} - ${a.numero}` : a.numero}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apt-password">Senha</Label>
                    <Input id="apt-password" name="password" type="password" required />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading || !aptId}>
                    {loading ? 'Entrando...' : 'Entrar como Morador'}
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
