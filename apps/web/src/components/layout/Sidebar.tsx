'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Building2, Users, UserCog, Package, CalendarDays,
  MessageSquare, Cpu, LayoutDashboard, LogOut, Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { clearSession, getSession } from '@/lib/auth';
import { auth } from '@/lib/api';

const ADMIN_ITEMS = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/apartamentos', icon: Building2, label: 'Apartamentos' },
  { href: '/admin/moradores', icon: Users, label: 'Moradores' },
  { href: '/admin/funcionarios', icon: UserCog, label: 'Funcionários' },
  { href: '/admin/encomendas', icon: Package, label: 'Encomendas' },
  { href: '/admin/reservas', icon: CalendarDays, label: 'Reservas' },
  { href: '/admin/whatsapp', icon: MessageSquare, label: 'WhatsApp' },
  { href: '/admin/hikvision', icon: Cpu, label: 'Hikvision' },
];

const FUNCIONARIO_ITEMS = [
  { href: '/porteiro', icon: Package, label: 'Portaria' },
];

const MORADOR_ITEMS = [
  { href: '/me', icon: Package, label: 'Encomendas' },
  { href: '/me/reservas', icon: CalendarDays, label: 'Reservas' },
  { href: '/me/moradores', icon: Users, label: 'Moradores' },
];

const HOME_BY_ROLE: Record<string, string> = {
  ADMIN: '/admin',
  FUNCIONARIO: '/porteiro',
  MORADOR: '/me',
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const session = getSession();
  const role = session?.role ?? 'ADMIN';

  const navItems =
    role === 'ADMIN' ? ADMIN_ITEMS :
    role === 'FUNCIONARIO' ? FUNCIONARIO_ITEMS :
    MORADOR_ITEMS;

  const home = HOME_BY_ROLE[role] ?? '/';
  const isHome = pathname === home || (home !== '/' && pathname === home);

  async function handleLogout() {
    try { await auth.logout(); } catch {}
    clearSession();
    router.push('/login');
  }

  return (
    <aside className="flex h-full w-56 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <span className="text-lg font-semibold tracking-tight">Condomínio</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {/* Botão Início — aparece em sub-páginas */}
        {!isHome && (
          <Link
            href={home}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors text-sidebar-foreground/70 hover:bg-sidebar-border hover:text-sidebar-foreground mb-2 border-b border-sidebar-border pb-3"
          >
            <Home className="h-4 w-4 shrink-0" />
            Início
          </Link>
        )}

        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== home && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-border hover:text-sidebar-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-border hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sair
        </button>
      </div>
    </aside>
  );
}
