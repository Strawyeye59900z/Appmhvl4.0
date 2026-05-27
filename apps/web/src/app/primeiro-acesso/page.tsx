'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Lock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { auth as authApi } from '@/lib/api';
import { saveSession, parseJwtPayload } from '@/lib/auth';

function PrimeiroAcessoForm() {
  const router = useRouter();
  const params = useSearchParams();
  const numeroApartamento = params.get('numero') ?? '';
  const apartamentoId = params.get('id') ?? '';

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  async function handleSenha(e: React.FormEvent) {
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
      const res = await authApi.setupMorador({
        apartamentoId: apartamentoId || numeroApartamento,
        novaSenha
      });
      const payload = parseJwtPayload(res.accessToken);
      if (!payload) throw new Error('Token inválido');
      saveSession({ accessToken: res.accessToken, role: payload.role, sub: payload.sub });
      setSucesso(true);
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao definir senha');
    } finally {
      setLoading(false);
    }
  }

  if (!numeroApartamento && !apartamentoId) {
    return (
      <p className="text-sm text-destructive text-center">
        Link inválido. Volte para a <a href="/login" className="underline font-bold">tela de login</a>.
      </p>
    );
  }

  if (sucesso) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="p-4 bg-green-100 rounded-full">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Tudo pronto!</h2>
          <p className="text-sm text-muted-foreground">
            Sua senha foi configurada com sucesso. Agora você pode acessar o aplicativo.
          </p>
        </div>

        <Button
          onClick={() => router.replace('/me')}
          className="w-full"
        >
          Ir para meu painel
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSenha} className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-semibold block">Nova senha</label>
        <div className="relative">
          <Input
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
        <label className="text-sm font-semibold block">Confirmar senha</label>
        <Input
          type={mostrarSenha ? 'text' : 'password'}
          placeholder="Repita a senha"
          value={confirmar}
          onChange={(e) => { setConfirmar(e.target.value); setErro(''); }}
          required
          autoComplete="new-password"
        />
      </div>

      {erro && <p className="text-sm text-destructive font-medium">{erro}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Salvando...' : 'Concluir'}
      </Button>
    </form>
  );
}

export default function PrimeiroAcessoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Primeiro acesso</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure sua senha
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-background rounded-lg border shadow-sm p-6 space-y-5">
          <Suspense fallback={<p className="text-sm text-muted-foreground text-center">Carregando...</p>}>
            <PrimeiroAcessoForm />
          </Suspense>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground text-center">
          Já tem conta? <a href="/login" className="underline font-bold hover:text-foreground">Faça login</a>
        </p>
      </div>
    </div>
  );
}
