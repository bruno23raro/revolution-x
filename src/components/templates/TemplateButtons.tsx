'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, GripVertical } from 'lucide-react';

interface TemplateButtonsProps {
  buttons: any[];
  onUpdate: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
}

const BUTTON_TYPES = [
  { value: 'QUICK_REPLY', label: 'Resposta Rápida' },
  { value: 'URL', label: 'URL' },
  { value: 'PHONE_NUMBER', label: 'Número de Telefone' },
  { value: 'COPY_CODE', label: 'Copiar Código' },
  { value: 'OTP', label: 'Código OTP' },
];

const SUB_TYPES: Record<string, string[]> = {
  QUICK_REPLY: ['reply'],
  URL: ['url'],
  PHONE_NUMBER: ['phone'],
  COPY_CODE: ['copy_code'],
  OTP: ['otp'],
};

export function TemplateButtons({ buttons, onUpdate, onRemove }: TemplateButtonsProps) {
  return (
    <div className="space-y-2">
      {buttons.map((btn, index) => (
        <div
          key={index}
          className="border rounded-lg p-4 bg-gray-50"
        >
          <div className="flex gap-2 items-start">
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Select value={btn.type} onValueChange={(v) => onUpdate(index, 'type', v)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Tipo de botão" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUTTON_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Texto do botão"
                  value={btn.text || ''}
                  onChange={(e) => onUpdate(index, 'text', e.target.value)}
                  maxLength={25}
                />
              </div>

              {btn.type === 'URL' && (
                <Input
                  placeholder="https://..."
                  value={btn.subType || ''}
                  onChange={(e) => onUpdate(index, 'subType', e.target.value)}
                />
              )}

              {btn.type === 'PHONE_NUMBER' && (
                <Input
                  placeholder="+55 11 99999-9999"
                  value={btn.subType || ''}
                  onChange={(e) => onUpdate(index, 'subType', e.target.value)}
                />
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemove(index)}
              className="hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}