'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth as authApi } from '@/lib/api';
import { saveSession, parseJwtPayload } from '@/lib/auth';

function PrimeiroAcessoForm() {
  const router = useRouter();
  const params = useSearchParams();
  const apartamentoId = params.get('id') ?? '';

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    if (novaSenha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmar) {
      setErro('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.setupMorador({ apartamentoId, novaSenha });
      const payload = parseJwtPayload(res.accessToken);
      if (!payload) throw new Error('Token inválido');
      saveSession({ accessToken: res.accessToken, role: payload.role, sub: payload.sub });
      router.replace('/me');
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao definir senha');
    } finally {
      setLoading(false);
    }
  }

  if (!apartamentoId) {
    return (
      <p className="text-sm text-destructive text-center">
        Link inválido. Volte para a <a href="/login" className="underline">tela de login</a>.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="novaSenha">Nova senha</Label>
        <div className="relative">
          <Input
            id="novaSenha"
            type={mostrarSenha ? 'text' : 'password'}
            placeholder="Mínimo 6 caracteres"
            value={novaSenha}
            onChange={(e) => { setNovaSenha(e.target.value); setErro(''); }}
            required
            autoFocus
            autoComplete="new-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmar">Confirmar senha</Label>
        <Input
          id="confirmar"
          type={mostrarSenha ? 'text' : 'password'}
          placeholder="Repita a senha"
          value={confirmar}
          onChange={(e) => { setConfirmar(e.target.value); setErro(''); }}
          required
          autoComplete="new-password"
        />
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Salvando...' : 'Definir senha e entrar'}
      </Button>
    </form>
  );
}

export default function PrimeiroAcessoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Primeiro acesso</h1>
          <p className="text-sm text-muted-foreground text-center">
            Crie uma senha para o seu apartamento.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Criar senha</CardTitle>
            <CardDescription>
              Esta senha será usada em todos os próximos acessos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando...</p>}>
              <PrimeiroAcessoForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
