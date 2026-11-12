'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X } from 'lucide-react';
import { TemplateHeader } from './TemplateHeader';
import { TemplateBody } from './TemplateBody';
import { TemplateFooter } from './TemplateFooter';
import { TemplateButtons } from './TemplateButtons';
import type { TemplateCreateRequest, TemplateComponent, TemplateButton, TemplateHeader as TemplateHeaderType, TemplateFooter as TemplateFooterType } from '@/types';

interface HeaderState {
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  text?: string;
  format?: string;
  mediaHandle?: string;
  example?: string;
}

interface ButtonState {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'OTP';
  text: string;
  subType?: string;
  index?: number;
}

interface TemplateFormInitialData {
  name?: string;
  category?: string;
  language?: string;
  header?: TemplateHeaderType;
  body?: string;
  footer?: TemplateFooterType;
  buttons?: TemplateButton[];
}

interface TemplateFormProps {
  onSubmit: (data: TemplateCreateRequest) => void;
  onCancel: () => void;
  initialData?: TemplateFormInitialData;
}

const CATEGORIES = [
  { value: 'MARKETING', label: 'MARKETING' },
  { value: 'UTILITY', label: 'UTILITY' },
  { value: 'AUTHENTICATION', label: 'AUTHENTICATION' },
] as const;

const HEADER_TYPES = [
  { value: 'TEXT', label: 'Texto' },
  { value: 'IMAGE', label: 'Imagem' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'DOCUMENT', label: 'Documento' },
  { value: 'LOCATION', label: 'Localizacao' },
] as const;

const BUTTON_TYPES = [
  { value: 'QUICK_REPLY', label: 'Resposta Rapida' },
  { value: 'URL', label: 'URL' },
  { value: 'PHONE_NUMBER', label: 'Numero de Telefone' },
  { value: 'COPY_CODE', label: 'Copiar Codigo' },
  { value: 'OTP', label: 'Codigo OTP' },
] as const;

export function TemplateForm({ onSubmit, onCancel, initialData }: TemplateFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [category, setCategory] = useState(initialData?.category || 'MARKETING');
  const [language, setLanguage] = useState(initialData?.language || 'pt_BR');

  // Componentes
  const [header, setHeader] = useState(initialData?.header || null);
  const [headerType, setHeaderType] = useState(initialData?.header?.type || 'TEXT');
  const [body, setBody] = useState(initialData?.body || '');
  const [footer, setFooter] = useState(initialData?.footer?.text || '');
  const [buttons, setButtons] = useState<Array<any>>(initialData?.buttons || []);

  const [errors, setErrors] = useState<string[]>([]);

  function validate(): string[] {
    const newErrors: string[] = [];

    // Validar nome
    if (!name || name.length === 0) {
      newErrors.push('Nome e obrigatorio');
    } else if (name.length > 50) {
      newErrors.push('Nome deve ter ate 50 caracteres');
    } else if (!/^[a-z][a-z0-9_]*$/.test(name)) {
      newErrors.push('Nome deve comecar com letra minuscula e conter apenas letras minusculas, numeros e underscores');
    }

    // Validar categoria
    if (!CATEGORIES.some(c => c.value === category)) {
      newErrors.push('Categoria e obrigatoria');
    }

    // Validar corpo
    if (!body || body.length === 0) {
      newErrors.push('Corpo e obrigatorio');
    }

    // Validar variaveis
    const varCount = (body.match(/\{\{\d+\}\}/g) || []).length;

    if (header?.type === 'IMAGE' || header?.type === 'VIDEO' || header?.type === 'DOCUMENT') {
      if (!header?.mediaHandle) {
        newErrors.push(`Media e obrigatoria para header ${headerType === 'IMAGE' ? 'de imagem' : headerType === 'VIDEO' ? 'de video' : 'de documento'}`);
      }
    }

    // Validar botoes
    for (const btn of buttons) {
      if (!btn.text || btn.text.length === 0) {
        newErrors.push('Texto do botao e obrigatorio');
      }
    }

    return newErrors;
  }

  function handleSubmit() {
    const newErrors = validate();
    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors([]);

    const components: any[] = [];

    // Header
    if (header) {
      components.push({
        type: 'HEADER',
        format: header.type === 'TEXT' ? 'TEXT' : headerType,
        text: header.type === 'TEXT' ? header.text : undefined,
      });
    }

    // Body
    if (body) {
      const variables: string[] = [];
      let idx = 1;
      let match;
      const regex = /\{\{\d+\}\}/g;
      while ((match = regex.exec(body)) !== null) {
        variables.push(`variavel_${idx}`);
        idx++;
      }

      components.push({
        type: 'BODY',
        text: body,
      });
    }

    // Footer
    if (footer) {
      components.push({
        type: 'FOOTER',
        text: footer,
      });
    }

    // Buttons
    if (buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: buttons.map((btn, idx) => ({
          type: btn.type,
          text: btn.text,
          sub_type: btn.type === 'QUICK_REPLY' ? 'reply' : btn.subType?.toLowerCase(),
        })),
      });
    }

    const data = {
      name,
      category: category as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION',
      language,
      components,
    };

    onSubmit(data);
  }

  function addButton() {
    setButtons([...buttons, { type: 'QUICK_REPLY', text: '', subType: 'reply', index: buttons.length }]);
  }

  function updateButton(index: number, field: string, value: any) {
    const newButtons = [...buttons];
    newButtons[index] = { ...newButtons[index], [field]: value };
    setButtons(newButtons);
  }

  function removeButton(index: number) {
    setButtons(buttons.filter((_, i) => i !== index));
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Novo Template</CardTitle>
        {errors.length > 0 && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <ul className="list-disc list-inside text-red-600 text-sm space-y-1">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Nome do Template */}
        <div className="space-y-2">
          <Label htmlFor="name">Nome do Template</Label>
          <Input
            id="name"
            placeholder="ex: promocao_black_friday"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            maxLength={50}
          />
          <p className="text-xs text-gray-500">
            Deve comecar com letra minuscula, conter apenas letras minusculas, numeros e underscores
          </p>
        </div>

        {/* Categoria */}
        <div className="space-y-2">
          <Label htmlFor="category">Categoria</Label>
          <Select value={category} onValueChange={setCategory as any}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a categoria" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            MARKETING: para operacoes e campanhas | UTILITY: para notificacoes util | AUTHENTICATION: para codigos de verificacao
          </p>
        </div>

        {/* Idioma */}
        <div className="space-y-2">
          <Label htmlFor="language">Idioma</Label>
          <Input
            id="language"
            placeholder="pt_BR"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
        </div>

        {/* Header */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>Header (Opcional)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setHeader(prev => prev ? null : { type: 'TEXT', text: '' })}
            >
              {header ? 'Editar Header' : 'Adicionar Header'}
            </Button>
          </div>

          {header && (
            <TemplateHeader
              header={header}
              headerType={headerType}
              setHeaderType={setHeaderType}
              onHeaderChange={setHeader}
            />
          )}
        </div>

        {/* Body */}
        <div className="space-y-2">
          <Label>Corpo do Template</Label>
          <Textarea
            placeholder="Ex: Ola [1], sua promocao esta aqui!"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
          />
          <p className="text-xs text-gray-500">
            Use variaveis numericas [1], [2] para substituir na hora do envio
          </p>
        </div>

        {/* Footer */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="footer">Footer (Opcional)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFooter(prev => prev ? '' : 'Revolution X')}
            >
              {footer ? 'Editar Footer' : 'Adicionar Footer'}
            </Button>
          </div>

          {footer && (
            <Input
              id="footer"
              placeholder="Texto do footer"
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
            />
          )}
        </div>

        {/* Botoes */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>Botoes (Opcional)</Label>
            <Button type="button" variant="outline" size="sm" onClick={addButton}>
              + Adicionar Botao
            </Button>
          </div>

          {buttons.length > 0 && (
            <TemplateButtons
              buttons={buttons}
              onUpdate={updateButton}
              onRemove={removeButton}
            />
          )}
        </div>

        {/* Acoes */}
        <div className="flex gap-2 justify-end pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Criar Template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}