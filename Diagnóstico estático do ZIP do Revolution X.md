# Diagnóstico estático do ZIP do Revolution X

O snapshot em `X.zip` contém uma explicação de alta confiança para o comportamento “conecta no navegador, mas volta como desconectado” e uma causa direta para os templates não aparecerem pelo canal OpenBSP. O ZIP original não foi extraído nem alterado; não li arquivos `.env` ou o perfil `.auth/chrome`, e não executei aplicação, testes, instalação, Docker, banco ou deploy.

## Conexão OpenBSP: o sucesso inicia outro onboarding

O card oficial já inicia o onboarding em `WhatsAppOfficialCard.tsx:50-61`. Depois, ele consulta `/api/integrations/openbsp/callback`; ao detectar `connected`, atualiza seu estado e chama `onConnected` (`WhatsAppOfficialCard.tsx:64-73`).

Na página `/integracoes`, essa callback está ligada a `handleConnected('whatsapp')` (`app/integracoes/page.tsx:250-252`). Porém, `handleConnected` não é apenas uma notificação: ele faz outro `POST /api/integrations/openbsp/connect` (`app/integracoes/page.tsx:91-101`). A rota de conexão, por sua vez, chama `upsertChannelPending` e grava o estado `PENDING` (`app/api/integrations/openbsp/connect/route.ts:63-75`). Portanto, após o onboarding ter sido confirmado como conectado, o callback do card pode abrir um segundo onboarding e regravar o canal como pendente. Isso corresponde de perto ao sintoma relatado.

**Correção mínima proposta:** para o card oficial, a callback de sucesso deve apenas avisar/atualizar a interface. Ela não deve chamar `handleConnected`, pois esse handler inicia uma conexão nova. O patch separado abaixo troca somente essa callback e não altera nem apaga o ZIP ou outros arquivos do projeto.

**Como confirmar sem enviar mensagens:** adicionar um teste E2E com as rotas mockadas: o clique deve gerar exatamente um `POST /connect`; o polling deve receber `connected: true`; após a callback, o status deve continuar `CONNECTED` e a tela deve mostrar conectado. O E2E já existente (`tests/e2e/whatsapp-official.spec.ts`) verifica a abertura do popup e também tem um caso que injeta um status conectado, mas não percorre a sequência de sucesso do polling. Os testes de rota em `src/tests/whatsapp-official-routes.test.ts` cobrem autenticação e alguns erros, não essa regressão. Não rodei os testes.

## Templates: três caminhos que não se encontram

A interface legada em `app/whatsapp/templates/client-page.tsx:46-53` carrega `/api/whatsapp/templates`. Essa rota (`app/api/whatsapp/templates/route.ts:11-18, 34-53`) consulta a integração direta com Meta por `resolveTenantMetaAccess`, que resolve credenciais em uma trilha distinta da conexão OpenBSP armazenada em `whatsapp_channels`.

Já o endpoint “oficial” em `app/api/integrations/whatsapp-official/templates/route.ts` faz `GET` apenas do espelho local de templates (`:29-43`). No `POST`, ele delega a criação ao provider configurado (`:67-82`). Mas, no snapshot, o provider OpenBSP retorna erro deliberadamente para listar/criar/consultar estado de templates (`src/integrations/whatsapp/openbsp/provider.ts:16-18, 49-66`). Assim, a interface Meta não vê automaticamente o canal OpenBSP, e o endpoint OpenBSP não consegue consultar/criar templates: a ausência não é apenas um problema de aparência.

Há ainda uma divergência interna importante: `docs/RX_OPENBSP_CONTRACT_SUMMARY.md:42-44` afirma que a integração OpenBSP expõe uma Edge Function de gestão de templates (`/functions/v1/whatsapp-management/templates`), enquanto o provider afirma que templates exigem Graph diretamente. O documento é evidência do contrato que o próprio projeto pretendia usar, mas não verifiquei essa função contra a instância OpenBSP configurada. Antes de alterar código, confirme que a versão/instância usa esse endpoint e valide seus formatos de autenticação e resposta sem expor chaves.

**Decisão arquitetural recomendada:** escolher um único caminho de templates por canal. Ou a UI lista/cria/sincroniza templates usando a função oficial do OpenBSP, conforme o contrato verificado, ou usa a integração direta com Meta para a WABA correspondente. Em qualquer opção, lista, criação, atualização de status e envio precisam consultar a mesma conta/canal. Não marcar template como aprovado localmente: usar o status informado pela plataforma.

## Bloqueio preventivo antes de campanhas

A rota `app/api/integrations/send-campaign/[channel]/route.ts:90-116` seleciona todos os contatos da organização quando não recebe destinatários nem segmento. Ela então chama `sendMassViaOpenBSP`; essa função percorre os destinatários e envia texto ou o template recebido/configurado (`src/integrations/openbsp/send.ts:214-252`). Na rota `app/api/whatsapp/send/route.ts:91-138`, a lista de destinatários também vem do corpo da requisição, e o handler monta opções de texto/template sem uma checagem visível de consentimento ou do estado aprovado do template. Não encontrei salvaguardas equivalentes nesses caminhos imediatos.

**Não execute campanhas por essas rotas no ambiente real até revisar isso.** O servidor deve comprovar opt-in válido e escopo para cada destinatário, respeitar descadastro/lista de supressão e bloquear templates sem aprovação válida; a regra de janela de atendimento também precisa ser aplicada no servidor. Isso vale mesmo usando uma API oficial. Não é apropriado tentar disfarçar mensagens frias como humanas ou contornar filtros/banimentos; o caminho seguro é contato consentido, templates oficiais aprovados quando exigidos e tratamento de opt-out.

## Risco de credenciais no arquivo enviado

O inventário do ZIP encontrou `.auth/chrome`, arquivos `.env`/`.env.local`/`.env.production` e configurações de segredos do Supabase. Não abri nenhum desses arquivos. O perfil do navegador pode conter cookies/sessões válidas, e os arquivos de ambiente podem conter chaves; trate ambos como potencialmente expostos pelo upload, sem presumir que eu tenha lido seus valores.

A partir de um dispositivo confiável, encerre/revogue sessões que possam estar no perfil e rotacione as credenciais que existam nesses arquivos: por exemplo, tokens de Meta, OpenBSP, Supabase, GitHub, Vercel, Hostinger e chaves de criptografia/banco. Faça a rotação nos próprios provedores e atualize os segredos do deploy sem colar valores no chat. O ZIP também contém histórico Git; não publique o arquivo inteiro nem faça push antes de verificar histórico e artefatos por segredos. Preserve a cópia original, mas guarde-a em local protegido.

## Caminho de recuperação sem apagar dados

1. Preserve `X.zip` intacto. Antes de executar qualquer script do projeto, rotacione credenciais potencialmente expostas e confira os scripts de `package.json` em uma cópia segura.
2. Trate `X/` como a aplicação Next.js principal e `X/FrontCode/` como outra raiz de código até confirmar sua relação. Há também worktrees e artefatos de build no arquivo; não mescle cópias pelo nome nem “limpe” diretórios.
3. Faça a correção mínima do callback em uma cópia/branch separada e acrescente o teste de regressão acima. Não é necessária migração de banco para essa correção proposta.
4. Escolha e confirme o único fluxo de templates OpenBSP ou Meta, então teste listagem/criação/status com fixtures ou conta de teste. Não teste campanhas nem use contatos reais.
5. Revise opt-in, opt-out, aprovação de template, limite/estado do canal, idempotência e isolamento por organização em todas as rotas de envio antes de liberar qualquer envio autorizado.
6. Valide primeiro em deployment Preview/staging. Compare commit, variáveis por ambiente sem imprimir valores, banco/projeto correto e logs redigidos. Só promova a produção após o teste controlado.

Não tenho acesso ao Windows local, ao VS Code nem ao `agent-desktop` nesta sessão e, portanto, não fiz varredura administrativa no computador. O relatório de pesquisa anterior contém fontes oficiais, arquitetura de deploy e um inventário PowerShell somente de leitura: [pesquisa e comandos de inventário](/home/ubuntu/whatsapp_project_recovery_research_ptbr.md).

## Arquivos do snapshot que sustentam os achados

- `X/app/integracoes/page.tsx` (91-119, 250-252)
- `X/src/components/integrations/WhatsAppOfficialCard.tsx` (50-75)
- `X/app/api/integrations/openbsp/connect/route.ts` (63-75)
- `X/src/integrations/whatsapp/openbsp/provider.ts` (16-18, 49-66)
- `X/app/api/integrations/whatsapp-official/templates/route.ts` (29-43, 67-82)
- `X/app/whatsapp/templates/client-page.tsx` (46-53)
- `X/app/api/whatsapp/templates/route.ts` (11-18, 34-53)
- `X/docs/RX_OPENBSP_CONTRACT_SUMMARY.md` (42-44)
- `X/app/api/integrations/send-campaign/[channel]/route.ts` (90-150)
- `X/app/api/whatsapp/send/route.ts` (91-138)
- `X/src/integrations/openbsp/send.ts` (214-252)
- `X/src/tests/whatsapp-official-routes.test.ts` e `X/tests/e2e/whatsapp-official.spec.ts`
