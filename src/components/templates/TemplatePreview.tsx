'use client';

import { Dialog, DialogContent as DialogPanel, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Check, X, Clock, Send, Copy } from 'lucide-react';
import { useState, useCallback } from 'react';

interface Template {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  componentsJson?: any;
  rejectionReason?: string | null;
  createdAt?: string;
  qualityScore?: number;
}

interface TemplatePreviewProps {
  template: Template;
  open: boolean;
  onClose: () => void;
  onSendTest?: (templateId: string, to: string, variables: string[]) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: 'Pendente', color: 'default', icon: Clock },
  APPROVED: { label: 'Aprovado', color: 'success', icon: Check },
  REJECTED: { label: 'Rejeitado', color: 'destructive', icon: X },
  PAUSED: { label: 'Pausado', color: 'secondary', icon: Clock },
  DISABLED: { label: 'Desativado', color: 'outline', icon: X },
};

export function TemplatePreview({ template, open, onClose, onSendTest }: TemplatePreviewProps) {
  const [testNumber, setTestNumber] = useState('');
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});

  const components = template.componentsJson || [];
  const header = components.find((c: any) => c.type === 'HEADER');
  const body = components.find((c: any) => c.type === 'BODY');
  const footer = components.find((c: any) => c.type === 'FOOTER');
  const buttons = components.find((c: any) => c.type === 'BUTTONS');
  const examples = components.find((c: any) => c.type === 'EXAMPLES');

  const status = STATUS_CONFIG[template.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = status.icon;

  // Extrair variáveis do corpo
  const bodyVars = body?.text?.match(/\{\{(\d+)\}\}/g) || [];

  // Atualizar preview quando variáveis mudam
  const getPreviewText = useCallback(() => {
    let text = body?.text || '';
    if (text) {
      bodyVars.forEach((match: string, index: number) => {
        const varName = `var${index + 1}`;
        const replacement = previewVariables[varName] || match;
        text = text.replace(new RegExp(match.replace(/[{}]/g, '\\$&'), 'g'), replacement);
      });
    }
    return text;
  }, [body?.text, bodyVars, previewVariables]);

  const handleSendTest = () => {
    if (!testNumber.trim()) return;

    const variables: string[] = [];
    if (body?.text) {
      const matches = body.text.match(/\{\{(\d+)\}\}/g);
      if (matches) {
        matches.forEach(() => variables.push('Exemplo'));
      }
    }

    onSendTest?.(template.id, testNumber, variables);
    setShowTestDialog(false);
    setTestNumber('');
  };

  function renderPreview() {
    return (
      <div className="border rounded-lg bg-white dark:bg-gray-900 p-6 max-w-sm mx-auto shadow-lg">
        {/* Header */}
        {header && (
          <div className="mb-3">
            {header.format === 'TEXT' ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800">
                <p className="text-blue-900 dark:text-blue-100 font-medium">{getPreviewText() || header.text}</p>
              </div>
            ) : (
              <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                <p className="text-gray-600 dark:text-gray-400">
                  {header.format === 'IMAGE' ? 'Imagem' :
                   header.format === 'VIDEO' ? 'Vídeo' : 'Documento'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Body */}
        {body && (
          <div className="mb-3">
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
              <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-sans text-sm">
                {getPreviewText() || body.text}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        {footer && (
          <div className="mb-3">
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center italic">
              {footer.text}
            </p>
          </div>
        )}

        {/* Buttons */}
        {buttons && buttons.buttons && buttons.buttons.length > 0 && (
          <div className="space-y-2 mt-3">
            {buttons.buttons.map((btn: any, idx: number) => (
              <div
                key={idx}
                className="border rounded p-2 text-center bg-gray-50 dark:bg-gray-800"
              >
                <p className="font-medium text-sm">{btn.text}</p>
                {btn.type === 'URL' && btn.subType && (
                  <p className="text-xs text-gray-500 break-all">{btn.subType}</p>
                )}
                {btn.type === 'PHONE_NUMBER' && btn.subType && (
                  <p className="text-xs text-gray-500">{btn.subType}</p>
                )}
                {btn.type === 'QUICK_REPLY' && (
                  <Badge variant="outline" className="text-xs mt-1">
                    Resposta Rápida
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogPanel className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle>{template.name}</DialogTitle>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{template.language}</Badge>
                  <Badge variant="outline" className="text-xs">{template.category}</Badge>
                  <Badge
                    variant={status.color === 'success' ? 'default' :
                            status.color === 'destructive' ? 'destructive' : 'outline'}
                    className="text-xs"
                  >
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {status.label}
                    {template.qualityScore && template.status === 'APPROVED' && (
                      <span className="ml-1">({template.qualityScore}/5)</span>
                    )}
                  </Badge>
                </div>
              </div>

              {template.status === 'REJECTED' && template.rejectionReason && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg max-w-md">
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">Motivo da rejeição:</p>
                  <p className="text-sm text-red-700 dark:text-red-300">{template.rejectionReason}</p>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Preview */}
            <div>
              <h3 className="font-medium mb-3">Visualização</h3>
              <div className="flex justify-center">
                {renderPreview()}
              </div>
            </div>

            {/* Details */}
            <div>
              <h3 className="font-medium mb-3">Detalhes</h3>

              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nome</p>
                  <p className="font-medium font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    {template.name}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Idioma</p>
                  <p className="font-medium">{template.language}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Categoria</p>
                  <p className="font-medium">{template.category}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                  <Badge
                    variant={status.color === 'success' ? 'default' :
                            status.color === 'destructive' ? 'destructive' : 'outline'}
                  >
                    {status.label}
                  </Badge>
                </div>

                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Componentes</p>
                  <ul className="text-sm space-y-1">
                    {header && <li className="flex items-center">• Header ({header.format || header.type})</li>}
                    {body && <li className="flex items-center">• Body</li>}
                    {footer && <li className="flex items-center">• Footer</li>}
                    {buttons?.buttons && buttons.buttons.length > 0 && (
                      <li className="flex items-center">• Botões ({buttons.buttons.length})</li>
                    )}
                  </ul>
                </div>

                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Criado em</p>
                  <p className="font-medium">
                    {template.createdAt
                      ? new Date(template.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'N/A'}
                  </p>
                </div>

                {template.id && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">ID do Template</p>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono break-all">
                        {template.id}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Copiar ID"
                        onClick={() => {
                          navigator.clipboard.writeText(template.id);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Acoes */}
              <div className="mt-6 space-y-2">
                {template.status === 'APPROVED' && onSendTest && (
                  <Button
                    className="w-full"
                    onClick={() => setShowTestDialog(true)}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Mensagem de Teste
                  </Button>
                )}

                {template.status === 'PENDING' && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled
                    title="Aguardando aprovação da Meta"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Em Análise
                  </Button>
                )}

                {template.status === 'REJECTED' && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled
                    title="Template rejeitado - revise e reenvie"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Rejeitado
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </DialogPanel>
      </Dialog>

      {/* Test Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogPanel>
          <DialogHeader>
            <DialogTitle>Enviar Mensagem de Teste</DialogTitle>
            <DialogDescription>
              Digite um número de telefone para enviar uma mensagem de teste.
              O template precisa estar APROVADO.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="test-number">Número do WhatsApp</Label>
              <Input
                id="test-number"
                type="tel"
                placeholder="+55 11 99999-9999"
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value)}
                className="mt-1"
              />
            </div>

            {bodyVars.length > 0 && (
              <div className="space-y-2">
                <Label>Variáveis de preview (opcional)</Label>
                {bodyVars.map((match: string, idx: number) => {
                  const varName = `var${idx + 1}`;
                  return (
                    <Input
                      key={idx}
                      type="text"
                      placeholder={`Valor para {{${idx + 1}}}`}
                      value={previewVariables[varName] || ''}
                      onChange={(e) => setPreviewVariables({ ...previewVariables, [varName]: e.target.value })}
                    />
                  );
                })}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowTestDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSendTest} disabled={!testNumber.trim()}>
                Enviar Teste
              </Button>
            </div>
          </div>
        </DialogPanel>
      </Dialog>
    </>
  );
}