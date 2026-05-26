import { Users } from 'lucide-react';

export default function MoradoresPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Moradores</h1>
      </div>
      <p className="text-muted-foreground">Gestão de moradores — em construção.</p>
    </div>
  );
}
