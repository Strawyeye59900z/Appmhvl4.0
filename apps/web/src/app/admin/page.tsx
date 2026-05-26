import { LayoutDashboard } from 'lucide-react';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Dashboard</h1>
      </div>
      <p className="text-muted-foreground">Bem-vindo ao painel administrativo.</p>
    </div>
  );
}
