'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, FileText, Clock, Check, X as XIcon, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import type { WhatsappTemplate } from '@/types';

interface TemplateListProps {
  templates: WhatsappTemplate[];
  isLoading: boolean;
  onSelect: (template: WhatsappTemplate) => void;
  onSendTest?: (templateId: string, to: string, variables: string[]) => void;
  onSync?: (templateId: string) => void;
  onDelete?: (templateId: string) => void;
  showTestButton?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: 'Pendente', color: 'default', icon: Clock },
  APPROVED: { label: 'Aprovado', color: 'success', icon: Check },
  REJECTED: { label: 'Rejeitado', color: 'destructive', icon: XIcon },
  PAUSED: { label: 'Pausado', color: 'secondary', icon: Clock },
  DISABLED: { label: 'Desativado', color: 'outline', icon: XIcon },
};

export function TemplateList({ templates, isLoading, onSelect, onSendTest, onSync, onDelete, showTestButton = false }: TemplateListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((n) => (
          <Card key={n} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 w-3/4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 w-1/2 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="font-medium mb-2">Nenhum template encontrado</h3>
          <p className="text-gray-500 text-sm mb-4">
            Crie seu primeiro template para começar a enviar mensagens pelo WhatsApp.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleSendTestClick = (template: WhatsappTemplate) => {
    const to = prompt('Digite o número para enviar a mensagem de teste:');
    if (to && template.id) {
      const bodyComponent = template.componentsJson?.find((c: any) => c.type === 'BODY');
      const variables = bodyComponent?.text?.match(/\{\{(\d+)\}\}/g) || [];
      const vars = variables.map(() => 'Exemplo');
      onSendTest?.(template.id, to, vars);
    }
  };

  return (
    <div className="space-y-3">
      {templates.map((template) => {
        const status = STATUS_CONFIG[template.status] || STATUS_CONFIG.PENDING;
        const StatusIcon = status.icon;
        const hasBody = template.componentsJson && Array.isArray(template.componentsJson);
        const bodyComponent = template.componentsJson?.find((c: any) => c.type === 'BODY');

        return (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1 flex-1">
                  <h3 className="font-medium text-base">{template.name}</h3>
                  <p className="text-xs text-gray-500">
                    {bodyComponent?.text?.substring(0, 80) || 'Sem corpo'}
                    {bodyComponent?.text?.length > 80 && '...'}
                  </p>
                  <div className="flex gap-2 flex-wrap mt-2">
                    <Badge variant="outline" className="text-xs">
                      {template.language}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {template.category}
                    </Badge>
                    <Badge
                      variant={status.color === 'success' ? 'default' :
                              status.color === 'destructive' ? 'destructive' :
                              'outline'}
                      className="text-xs"
                    >
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                    {template.rejectionReason && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Rejeitado
                      </Badge>
                    )}
                    {template.qualityScore && template.status === 'APPROVED' && (
                      <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-600">
                        Qualidade: {template.qualityScore}/5
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelect(template)}
                  >
                    Ver Detalhes
                  </Button>

                  {template.status === 'PENDING' && onSync && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onSync(template.id)}
                      title="Sincronizar com a Meta"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}

                  {showTestButton && template.status === 'APPROVED' && onSendTest && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSendTestClick(template)}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Testar
                    </Button>
                  )}

                  {onDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(template.id)}
                      className="hover:bg-red-100"
                      title="Excluir template"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}