import { Home } from 'lucide-react';

export default function MePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <Home className="h-10 w-10 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Área do Morador</h1>
      <p className="text-muted-foreground">Em construção.</p>
    </div>
  );
}
