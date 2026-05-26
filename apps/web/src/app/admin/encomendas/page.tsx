import { Package } from 'lucide-react';

export default function EncomendasPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Package className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Encomendas</h1>
      </div>
      <p className="text-muted-foreground">Gestão de encomendas — em construção.</p>
    </div>
  );
}
