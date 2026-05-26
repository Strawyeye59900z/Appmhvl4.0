import { Building2 } from 'lucide-react';

export default function ApartamentosPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Apartamentos</h1>
      </div>
      <p className="text-muted-foreground">Gestão de apartamentos — em construção.</p>
    </div>
  );
}
