import { CalendarDays } from 'lucide-react';

export default function ReservasPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Reservas</h1>
      </div>
      <p className="text-muted-foreground">Gestão de reservas — em construção.</p>
    </div>
  );
}
