import { MessageSquare } from 'lucide-react';

export default function WhatsAppPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">WhatsApp</h1>
      </div>
      <p className="text-muted-foreground">Integração WhatsApp — em construção.</p>
    </div>
  );
}
