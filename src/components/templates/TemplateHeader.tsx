'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';

interface TemplateHeaderProps {
  header: any;
  headerType: string;
  setHeaderType: (type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION') => void;
  onHeaderChange: (header: any) => void;
}

export function TemplateHeader({ header, headerType, setHeaderType, onHeaderChange }: TemplateHeaderProps) {
  function updateHeader(field: string, value: any) {
    const newHeader = { ...header, [field]: value };
    onHeaderChange(newHeader);
  }

  if (headerType === 'TEXT') {
    return (
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-medium">Tipo: Texto</h4>
          <button
            type="button"
            onClick={() => onHeaderChange(null)}
            className="p-1 hover:bg-gray-200 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2">
          <Label>Texto do Header</Label>
          <Input
            placeholder="Ex: Sua marca premium"
            value={header.text || ''}
            onChange={(e) => updateHeader('text', e.target.value)}
            maxLength={60}
          />
          <p className="text-xs text-gray-500">
            Até 60 caracteres. Aparecerá acima do corpo do texto.
          </p>
        </div>
      </div>
    );
  }

  if (headerType === 'IMAGE' || headerType === 'VIDEO' || headerType === 'DOCUMENT') {
    return (
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-medium">Tipo: {headerType === 'IMAGE' ? 'Imagem' : headerType === 'VIDEO' ? 'Vídeo' : 'Documento'}</h4>
          <button
            type="button"
            onClick={() => onHeaderChange(null)}
            className="p-1 hover:bg-gray-200 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2">
          <Label>
            Media Handle ID
          </Label>
          <Input
            placeholder="Digite o ID da mídia no Meta Business Manager"
            value={header.mediaHandle || ''}
            onChange={(e) => updateHeader('mediaHandle', e.target.value)}
          />
          <p className="text-xs text-amber-600">
            Requer mídia pré-carregada no Meta Business Manager antes da criação do template.
          </p>
        </div>
      </div>
    );
  }

  return null;
}