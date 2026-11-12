// FASE 5.1 — Client page do gerenciador de templates (melhorado)
'use client';

import { useState, useEffect, useCallback } from 'react';
import { TemplateForm } from '@/components/templates/TemplateForm';
import { TemplateList } from '@/components/templates/TemplateList';
import { TemplatePreview } from '@/components/templates/TemplatePreview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, RefreshCw, Filter, X, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { WhatsappTemplate } from '@/types';

interface TemplateFilters {
  search: string;
  category: string;
  status: string;
}

export function TemplatesPageClient() {
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<WhatsappTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsappTemplate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('my-templates');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [syncingTemplate, setSyncingTemplate] = useState<WhatsappTemplate | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();

  // Filtros
  const [filters, setFilters] = useState<TemplateFilters>({
    search: '',
    category: 'all',
    status: 'all',
  });

  // Carregar templates
  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/whatsapp/templates');
      if (!res.ok) throw new Error('Falha ao carregar templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os templates',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Aplicar filtros
  useEffect(() => {
    let result = templates;

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(t => t.name.toLowerCase().includes(searchLower));
    }

    if (filters.category !== 'all') {
      result = result.filter(t => t.category === filters.category);
    }

    if (filters.status !== 'all') {
      result = result.filter(t => t.status === filters.status);
    }

    setFilteredTemplates(result);
  }, [templates, filters]);

  async function refreshTemplates() {
    await loadTemplates();
    toast({
      title: 'Atualizado',
      description: 'Templates atualizados com sucesso',
    });
  }

  async function handleSyncTemplate(templateId: string) {
    try {
      const res = await fetch(`/api/whatsapp/templates/${templateId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.errorDetail || 'Falha ao sincronizar template');
      }

      const data = await res.json();
      toast({
        title: 'Sincronizado',
        description: `Template sincronizado com sucesso. Status: ${data.template?.status || ' atualizado'}`,
      });

      await loadTemplates();
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao sincronizar template',
        variant: 'destructive',
      });
    }
  }

  async function handleCreateTemplate(template: any) {
    try {
      const res = await fetch('/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.errorDetail || 'Falha ao criar template');
      }

      const data = await res.json();
      toast({
        title: 'Criado',
        description: `Template "${data.templateName}" criado com sucesso`,
      });

      await loadTemplates();
      setShowCreateForm(false);
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao criar template',
        variant: 'destructive',
      });
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    if (!confirm('Tem certeza que deseja excluir este template?')) return;

    try {
      const res = await fetch(`/api/whatsapp/templates/${templateId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.errorDetail || 'Falha ao excluir template');
      }

      toast({
        title: 'Excluído',
        description: 'Template excluído com sucesso',
      });

      await loadTemplates();
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao excluir template',
        variant: 'destructive',
      });
    }
  }

  function handleSelectTemplate(template: WhatsappTemplate) {
    setSelectedTemplate(template);
    setIsPreviewOpen(true);
  }

  function handleClosePreview() {
    setIsPreviewOpen(false);
    setSelectedTemplate(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Templates WhatsApp</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Gerencie seus templates de mensagem para o WhatsApp Business API
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Novo Template
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="my-templates">Meus Templates</TabsTrigger>
          <TabsTrigger value="synced">Sincronizados da Meta</TabsTrigger>
        </TabsList>

        <TabsContent value="my-templates" className="space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar templates..."
                    value={filters.search}
                    onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={filters.category} onValueChange={v => setFilters(prev => ({ ...prev, category: v }))}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="MARKETING">Marketing</SelectItem>
                      <SelectItem value="UTILITY">Utility</SelectItem>
                      <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filters.status} onValueChange={v => setFilters(prev => ({ ...prev, status: v }))}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="APPROVED">Aprovado</SelectItem>
                      <SelectItem value="PENDING">Pendente</SelectItem>
                      <SelectItem value="REJECTED">Rejeitado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={refreshTemplates} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Templates List */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(n => (
                <Card key={n} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                    <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  {filters.search || filters.category !== 'all' || filters.status !== 'all'
                    ? 'Nenhum template encontrado com estes filtros'
                    : 'Nenhum template criado ainda. Clique em "Novo Template" para começar.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <TemplateList
              templates={filteredTemplates}
              isLoading={false}
              onSelect={handleSelectTemplate}
              onSync={handleSyncTemplate}
              onDelete={handleDeleteTemplate}
              showTestButton
            />
          )}
        </TabsContent>

        <TabsContent value="synced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Templates da Meta</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Esta aba mostrará templates sincronizados diretamente da Meta Cloud API.
                Requer integração WhatsApp Business configurada.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setShowSyncDialog(true);
                }}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Sincronizar com Meta
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Template Dialog */}
      {showCreateForm && (
        <TemplateForm
          onCancel={() => setShowCreateForm(false)}
          onSubmit={handleCreateTemplate}
        />
      )}

      {/* Preview Dialog */}
      {isPreviewOpen && selectedTemplate && (
        <TemplatePreview
          template={selectedTemplate}
          open={isPreviewOpen}
          onClose={handleClosePreview}
          onSendTest={async (templateId, to, variables) => {
            try {
              const res = await fetch(`/api/whatsapp/templates/${templateId}/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to, variables }),
              });
              const data = await res.json();
              if (res.ok) {
                toast({ title: 'Enviado', description: 'Mensagem de teste enviada com sucesso' });
              } else {
                toast({ title: 'Erro', description: data.errorDetail || 'Falha ao enviar teste', variant: 'destructive' });
              }
            } catch {
              toast({ title: 'Erro', description: 'Falha ao enviar teste', variant: 'destructive' });
            }
          }}
        />
      )}

      {/* Sync Dialog */}
      {showSyncDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Sincronizar com Meta</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Isso buscará todos os templates da Meta Cloud API e atualizará sua lista local.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowSyncDialog(false)}>Cancelar</Button>
              <Button onClick={async () => {
                setShowSyncDialog(false);
                try {
                  const res = await fetch('/api/whatsapp/templates/sync', { method: 'POST' });
                  const data = await res.json();
                  if (res.ok) {
                    toast({ title: 'Sincronizado', description: `${data.templates?.length || 0} templates sincronizados` });
                    await loadTemplates();
                  } else {
                    toast({ title: 'Erro', description: data.errorDetail || 'Falha ao sincronizar', variant: 'destructive' });
                  }
                } catch {
                  toast({ title: 'Erro', description: 'Falha ao sincronizar', variant: 'destructive' });
                }
              }}>
                Sincronizar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}