'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface WhatsAppInputProps {
  ddd: string;
  numero: string;
  onDddChange: (v: string) => void;
  onNumeroChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
}

/** Retorna o número completo no formato E.164: +55DDNNNNNNNNN */
export function formatWhatsApp(ddd: string, numero: string): string {
  return `+55${ddd.replace(/\D/g, '')}${numero.replace(/\D/g, '')}`;
}

/** Valida se o número montado é válido (+55 + 2 dígitos DDD + 8 ou 9 dígitos) */
export function isWhatsAppValid(ddd: string, numero: string): boolean {
  const clean = ddd.replace(/\D/g, '') + numero.replace(/\D/g, '');
  return /^\d{10,11}$/.test(clean);
}

export function WhatsAppInput({
  ddd,
  numero,
  onDddChange,
  onNumeroChange,
  required = true,
  disabled = false,
}: WhatsAppInputProps) {
  return (
    <div className="space-y-1.5">
      <Label>
        WhatsApp{required ? '' : ' (opcional)'}
      </Label>
      <div className="flex gap-2 items-center">
        <span className="text-sm text-muted-foreground font-mono shrink-0">+55</span>
        <Input
          className="w-16 shrink-0"
          placeholder="11"
          maxLength={2}
          value={ddd}
          onChange={(e) => onDddChange(e.target.value.replace(/\D/g, '').slice(0, 2))}
          required={required}
          disabled={disabled}
          inputMode="numeric"
          aria-label="DDD"
        />
        <Input
          placeholder="999990000"
          maxLength={9}
          value={numero}
          onChange={(e) => onNumeroChange(e.target.value.replace(/\D/g, '').slice(0, 9))}
          required={required}
          disabled={disabled}
          inputMode="numeric"
          aria-label="Número"
        />
      </div>
      <p className="text-xs text-muted-foreground">DDD + número (ex: 11 + 999990000)</p>
    </div>
  );
}
