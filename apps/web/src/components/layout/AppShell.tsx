'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { cn } from '@/lib/utils';
import { getSession } from '@/lib/auth';
import { fotos as fotosApi } from '@/lib/api';
import { FotoCaptura } from '@/components/ui/foto-captura';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [precisaFoto, setPrecisaFoto] = useState<boolean | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) { setPrecisaFoto(false); return; }
    const role = session.role;
    if (role !== 'MORADOR' && role !== 'FUNCIONARIO') {
      setPrecisaFoto(false);
      return;
    }
    fotosApi.meuStatusFacial()
      .then((res) => setPrecisaFoto(res.status === 'SEM_FOTO'))
      .catch(() => setPrecisaFoto(false));
  }, []);

  if (precisaFoto === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    );
  }

  if (precisaFoto) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
        <div className="bg-background rounded-xl border shadow-sm p-8 max-w-sm w-full space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Foto de perfil</h1>
            <p className="text-sm text-muted-foreground">
              Para continuar, tire uma foto para seu perfil. Ela será usada no sistema de acesso do condomínio.
            </p>
          </div>
          <FotoCaptura
            label="Abrir câmera"
            onSuccess={() => setPrecisaFoto(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar desktop sempre visível, mobile condicional */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-30 transition-transform duration-200 md:relative md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Sidebar />
      </div>

      {/* Conteúdo principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav onMenuClick={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
