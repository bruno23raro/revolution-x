'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

interface TemplateFooterProps {
  footer: string;
  onFooterChange: (footer: string) => void;
}

export function TemplateFooter({ footer, onFooterChange }: TemplateFooterProps) {
  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-medium">Footer</h4>
        {footer && (
          <button
            type="button"
            onClick={() => onFooterChange('')}
            className="p-1 hover:bg-gray-200 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="footer">Texto do Footer</Label>
        <Input
          id="footer"
          placeholder="Ex: Revolution X • Descontos especiais"
          value={footer}
          onChange={(e) => onFooterChange(e.target.value)}
          maxLength={60}
        />
        <p className="text-xs text-gray-500">
          Texto opcional aparecerá no final da mensagem. Até 60 caracteres.
        </p>
      </div>
    </div>
  );
}