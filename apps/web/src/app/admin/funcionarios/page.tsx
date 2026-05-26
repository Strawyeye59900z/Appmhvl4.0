import { UserCog } from 'lucide-react';

export default function FuncionariosPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <UserCog className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Funcionários</h1>
      </div>
      <p className="text-muted-foreground">Gestão de funcionários — em construção.</p>
    </div>
  );
}
