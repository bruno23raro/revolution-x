# Relatório de pesquisa e plano de recuperação: WhatsApp Business e projeto parado

**Atualizado em 14 de novembro de 2026.** Esta pesquisa reúne documentação oficial da Meta/WhatsApp, GitHub, Vercel, Hostinger, fornecedores de ferramentas de desenvolvimento, legislação e orientações brasileiras. Não é possível pesquisar literalmente “toda a internet”; relatos de fóruns e redes sociais são anedóticos e não comprovam regras nem métodos confiáveis. O foco aqui é uma integração permitida e diagnosticável, não contornar anti-spam ou banimentos.

## 1. WhatsApp: fluxo sustentável, sem técnicas de evasão

A regra central não é “escrever como humano para não ser detectado”. A política exige que a empresa contate somente quem forneceu seu telefone ou identificador e aceitou receber mensagens daquela empresa. É preciso respeitar solicitações de parar, cancelar ou bloquear, inclusive quando chegam fora do WhatsApp. Spam e contatos inesperados são proibidos. A Meta não divulga todos os sinais ou limiares dos seus sistemas; portanto, promessas de “anti-ban”, aquecimento de número ou cadência que supostamente burle detecção não são uma garantia confiável nem uma forma apropriada de resolver o problema. [1] [2]

Na WhatsApp Business Platform, mensagens iniciadas pela empresa fora da janela de atendimento de 24 horas exigem template aprovado. Dentro da janela — aberta ou reiniciada por mensagem do usuário — a empresa pode responder sem template. Templates devem refletir sua finalidade: marketing, utility ou authentication. Não classifique oferta promocional como utility. Aprovação do template não substitui o opt-in. [1] [3]

Prática recomendada: aquisição inbound por formulário, QR code, inscrição voluntária ou anúncio que leve o próprio usuário a iniciar contato; guarde evidência proporcional da origem e do texto/escopo aceito; separe atualizações transacionais de marketing; mantenha descadastro simples e uma lista de supressão; monitore qualidade, feedback, limites e estado dos templates no WhatsApp Manager. Se houver restrição, use revisão e suporte oficiais, não outra conta, API não oficial ou tentativa de contornar o controle. [2] [4] [5]

### LGPD no Brasil

Telefone vinculado a uma pessoa identificável é dado pessoal. A LGPD prevê mais de uma base legal; legítimo interesse não é autorização geral para publicidade e requer avaliação concreta de finalidade, necessidade, expectativas, riscos e salvaguardas. Se a base for consentimento, ele deve ser demonstrável e para finalidade determinada, com mecanismo facilitado de revogação. A política da plataforma e a LGPD são requisitos distintos: cumprir um não substitui automaticamente o outro. Isto é informação geral, não parecer jurídico. [6] [7]

## 2. Como criar o app Meta: teste, uso próprio e produção

1. Crie o app Meta escolhendo o caso de uso de WhatsApp, associe o portfólio empresarial e conecte/crie a Messaging account no painel de API Setup. Comece com número/recursos de teste, token temporário e o fluxo oficial para primeiro envio e webhook. [8]
2. Um app nasce em modo Development; acesso a recursos é limitado a pessoas com papéis/permissões adequados. Mudar para Live não transforma automaticamente número ou conta de teste em produção. [9]
3. A documentação da Meta descreve acesso padrão para desenvolvedor que usa a API nos próprios ativos empresariais. Isso não elimina requisitos de conta empresarial, número elegível/registrado, token, webhook e política de mensagens. [10]
4. Se o app atender empresas clientes/ativos de terceiros, planeje a verificação empresarial, Advanced Access das permissões necessárias e App Review. Publicar o app não é o mesmo que obter aprovação de permissões. O painel da Meta para o caso concreto é a referência para permissões solicitadas e aprovadas. [10] [11]
5. Em produção, proteja tokens no servidor, registre o número próprio conforme fluxo oficial e teste o caminho completo com pessoas autorizadas: opt-in, template se exigido, webhook e confirmação do estado de entrega. [8] [12]

## 3. Diagnóstico do estado “conectando, mas não conectado”

O rótulo visual, sozinho, não tem uma causa universal documentada. A ordem abaixo evita mudar várias coisas ao mesmo tempo.

### Primeiro: identifique projeto, ambiente e IDs

Registre nome/ID do app, portfólio empresarial, conta WhatsApp, Messaging account (frequentemente ainda chamada WABA; associada ao `waba_id`), `phone_number_id`, número visível, ambiente (teste/produção), organização/tenant, branch e deployment. `phone_number_id` e `waba_id` são IDs diferentes. O modelo de contas da Meta está evoluindo; telas e nomenclaturas podem variar. [13]

### Depois, siga o ramo que corresponde ao sintoma

**A. O canal continua desconectado ou nem aparece na interface.**

- Confirme se frontend, API/Edge Functions e banco apontam para o mesmo ambiente/projeto e se a organização correta está selecionada.
- Se usa Embedded Signup, confirme a conclusão server-side. O popup fechar não prova que o backend trocou o código, recebeu o token e salvou a conexão; o código retornado expira em 30 segundos. [14]
- Verifique token, expiração, permissões e acesso do usuário de sistema aos ativos corretos. Em integrações de cliente, confira também o fluxo de inscrição da aplicação na Messaging account e o registro do telefone. [12] [15]
- Confirme se existe persistência para a organização certa, sem mostrar token ou segredo. Se não existe linha, investigue retorno do signup, troca do código e resposta de persistência. Se existe, confira status, IDs e horário. Não recrie o número ou a organização como primeiro passo.

**B. A conexão aparece, mas templates não aparecem ou não podem ser enviados.**

Templates são recursos da conta de mensagens. Consulte a conta correta, pagine o resultado e compare nome, idioma, categoria, componentes e status. Apenas um template aprovado pode ser enviado conforme as regras vigentes; `In-Review`, `Rejected`, `Paused` ou `Disabled` não equivalem a aprovado. Se a Meta mostra aprovado e sua UI não, investigue conta consultada e sincronização local antes de editar o template. [3] [5]

**C. Envio retorna aceito, mas não há status/mensagens recebidas.**

Um identificador `wamid` de resposta não prova entrega final. Confirme o webhook HTTPS público: GET de verificação, `hub.verify_token`, resposta com `hub.challenge`, validação de `X-Hub-Signature-256` no POST sobre o corpo bruto, inscrição do campo necessário e inscrição da app na Messaging account. Grave o evento antes de responder 200, faça o processamento idempotente e confira as atualizações de status e erros no webhook. A Meta pode reenviar eventos; trate duplicatas. [16] [17]

Para todas as falhas, guarde horário, ambiente, IDs usados e código/detalhes do erro Graph (`code`, `details`, `fbtrace_id`), sempre sem tokens, cookies ou dados pessoais desnecessários. Não repita indefinidamente o registro do número: há limites oficiais de tentativas e bloqueio temporário. [18]

### A hipótese específica OpenBSP

Há um projeto público chamado `matiasbattocchia/open-bsp-api`, acompanhado de `open-bsp-ui`. Ele é uma correspondência possível para “OpenBSP”, não confirmação de que seja a versão/fork do seu sistema. O projeto separa UI de API/Supabase. Seu guia descreve a conexão WhatsApp persistida em `organizations_addresses`, com serviço WhatsApp, estado conectado e endereço correspondente ao `phone_number_id`; também descreve logs e estados de integração. [19] [20]

Se for exatamente esse OpenBSP, os primeiros pontos somente de leitura são: UI aponta ao Supabase esperado; API/Edge Functions usam o mesmo projeto; organização/tenant selecionado corresponde à chave/API; a linha de conexão está na organização correta; e logs da troca do Embedded Signup mostram `code`, resposta de backend e IDs corretos, sem expor `access_token`. Um erro de RLS ou organização errada pode explicar uma persistência que não aparece na interface. O projeto também documenta UI separada e configurações da API. [20] [21]

Para templates, confira primeiro status e conta na Meta. A documentação pública não permite afirmar qual tabela/tela falhou na versão instalada sem repositório, deploy, configuração e logs. A ausência na UI não basta para concluir que o canal oficial não existe ou que a Meta rejeitou o template.

## 4. Arquitetura prática: GitHub, Vercel e Hostinger

Uma base comum, a ajustar após identificar a stack:

- GitHub é a fonte de código, histórico, CI e controle de deploy. Separe preview/staging de produção e segredos por ambiente. [22]
- Um endpoint HTTP curto recebe o webhook, valida a origem e persiste/enfileira com chave idempotente antes de confirmar. Não dependa de memória do processo ou disco efêmero para estado crítico.
- Frontend e webhook podem ficar em serviços distintos. Vercel Functions são adequadas a handlers curtos, mas têm limites de execução e payload; não processe filas longas dentro do request. Vercel Queues documenta fila durável, mas está em beta: avalie disponibilidade, custos e integração antes de depender dela. [23] [24]
- Se precisar de worker contínuo, Docker/serviços auxiliares ou controle de runtime, considere VPS com processo supervisionado, banco/fila durável, logs, monitoramento e backup. Não presuma que plano compartilhado Web/Cloud da Hostinger suporte worker residente; a documentação informa limites de timeout e ausência de workers sempre ativos nesses planos. [25]
- Defina qual plataforma publica cada hostname/serviço e evite deploy concorrente do mesmo componente. Compare commit e branch, build, root directory, versão Node, variáveis (sem imprimir valores), deployment, DNS/TLS e logs de runtime.

Sequência de teste: (1) HTTPS e GET de verificação; (2) webhook de teste Meta; (3) assinatura HMAC válida; (4) persistência e resposta 200; (5) repetição do mesmo evento para comprovar idempotência; (6) processamento pelo consumidor/fila; (7) status retornando à interface. Correlacione cada passo por ID de evento/deployment. [16] [17] [22]

## 5. Agentes, modelos e ferramentas: escolha condicional, não ranking absoluto

Não existe comparação confiável para ordenar “todas as IAs” de melhor a pior. Recursos, preços, modelos e limites mudam; a escolha deve ser testada no seu bug real e na sua stack. Também é importante separar **agente** (acesso a arquivos, terminal, navegador e revisão) de **modelo/provedor** (inferência, protocolo, ferramenta e política de dados).

**Se navegador integrado para reproduzir UI, console e rede é requisito:** comece comparando Cursor Agent e VS Code com browser tools; ambos documentam uso de navegador no fluxo do agente. VS Code também traz debugging interativo com breakpoints. [26] [27] **Claude Code** é uma opção forte de terminal/repositório, mas Chrome automation nativa tem requisitos próprios e não funciona ao usar determinados provedores terceiros. [28] **Codex IDE** serve para contexto de editor e revisão em diff; a extensão/CLI não oferece browser próprio segundo a documentação consultada, mas MCP pode integrar ferramenta externa se necessário. [29] [30]

**Modelo/provedor:** FreeLLMAPI se apresenta como gateway/router self-hosted, não como modelo de linguagem. O projeto declara suporte a protocolos de agentes e fornece configurações, mas suas alegações não substituem confirmação na documentação do cliente e teste do fluxo de ferramentas. Cursor lista provedores específicos para BYOK; não presuma que qualquer endpoint arbitrário funcione. [31] [32] NVIDIA NIM e inferência local em GPU AMD/Radeon/LM Studio podem ser opções técnicas, mas “OpenAI-compatible” não garante tool calling, qualidade ou compatibilidade com todos os agentes. [33] [34]

**Recomendação inicial:** um agente principal por vez, com modelo que passe um teste real de uso de ferramentas, e browser integrado ou Playwright apenas se necessário. Use checkpoint/branch, plano pequeno, diff revisado, testes automatizados e verificação manual do fluxo no browser. Evite paralelizar gravação no mesmo repositório sem worktrees.

**Segurança da pilha:** MCP local e extensões podem herdar permissões do aplicativo. Comece sem MCP; adicione um servidor só quando houver necessidade concreta e revise pacote, publicador, ferramentas e permissões. Rode VS Code/agentes/MCP como usuário padrão, não como administrador. Use Workspace Trust em pastas desconhecidas, sandbox e aprovação sob demanda, segredos fora dos prompts e de logs. Sandboxing e aprovação são controles diferentes; subagentes não são uma fronteira de segurança automática. [35] [36] [37]

## 6. PowerShell para inventário local somente de leitura

**Não consigo executar esses comandos no seu Windows a partir desta sessão.** O bloco abaixo apenas consulta a pasta indicada, Git e ferramentas; não instala nem altera nada e não mostra conteúdos de `.env`. Troque o caminho pela pasta correta. Ele não faz varredura indiscriminada do disco inteiro.

```powershell
$ProjectPath = 'C:\caminho\para\a\pasta-do-projeto'

if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) {
    Write-Error "Pasta não encontrada. Corrija `$ProjectPath e execute novamente."
    return
}

Push-Location -LiteralPath $ProjectPath
try {
    Write-Host "`n=== Pasta e arquivos de primeiro nível ==="
    Get-Location
    Get-ChildItem -Force |
        Select-Object Mode, Length, LastWriteTime, Name

    Write-Host "`n=== Git: raiz, branch, estado, último commit ==="
    git rev-parse --show-toplevel 2>$null
    git status --short --branch 2>$null
    git log -1 --format='%h %s' 2>$null
    Write-Host 'Nomes dos remotes (sem URLs):'
    git remote 2>$null

    Write-Host "`n=== Arquivos comuns de configuração: somente existência ==="
    @(
        'package.json', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock',
        'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
        'compose.yml', 'compose.yaml', 'supabase\config.toml',
        '.env', '.env.local'
    ) | ForEach-Object {
        [pscustomobject]@{
            Arquivo = $_
            Existe  = Test-Path -LiteralPath (Join-Path $ProjectPath $_)
        }
    } | Format-Table -AutoSize

    Write-Host "`n=== Ferramentas instaladas: descoberta de comandos/versões ==="
    Get-Command git, node, npm, pnpm, docker, wsl -ErrorAction SilentlyContinue |
        Select-Object Name, Source
    if (Get-Command node -ErrorAction SilentlyContinue) { node --version }
    if (Get-Command npm -ErrorAction SilentlyContinue) { npm --version }
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        docker version --format 'Docker client={{.Client.Version}} server={{.Server.Version}}' 2>$null
        docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' 2>$null
    }
    if (Get-Command wsl -ErrorAction SilentlyContinue) {
        wsl --list --verbose
    }
}
finally {
    Pop-Location
}
```

O comando `git remote` lista apenas nomes, não URLs que eventualmente poderiam conter credenciais. O bloco consulta containers ativos, mas não os inicia nem para. Não cole saídas que revelem domínio privado, caminho sensível ou informação de cliente sem revisar. Nunca envie `.env`, tokens, app secret, PIN, cookies, chaves, payloads pessoais ou URLs com credenciais.

## O que falta para diagnosticar e corrigir o seu projeto

Envie o caminho completo da pasta Windows e o URL do repositório (ou ZIP sem segredos), o link/nome exato do OpenBSP, stack e forma de rodar Docker, além do URL/serviço de deploy. Para o problema Meta, informe se é uso próprio ou onboarding de clientes, ambiente (teste/produção), IDs não secretos de app/contas/número, texto e horário do erro, e logs Graph redigidos com `code/details/fbtrace_id`. Não é necessário instalar agentes ou extensões em massa antes disso. A etapa segura é ler estado, criar plano e só então propor correções focadas, preservando os arquivos existentes.

## Referências

[1]: https://whatsappbusiness.com/policy/ "WhatsApp Business Messaging Policy"
[2]: https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in "Get opt-in for WhatsApp"
[3]: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview "Template fundamentals"
[4]: https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits "Messaging Limits"
[5]: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization "Template categorization"
[6]: https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-publicacaooriginal-156212-pl.html "Lei nº 13.709 de 2018"
[7]: http://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_legitimo_interesse.pdf/@@display-file/file "Guia ANPD sobre legítimo interesse"
[8]: https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started "WhatsApp Cloud API Get Started"
[9]: https://developers.facebook.com/documentation/development/build-and-test/app-modes "App Modes"
[10]: https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/app-review "WhatsApp app review"
[11]: https://developers.facebook.com/documentation/development/graph-api/overview/access-levels "Access Levels"
[12]: https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens/ "Access Tokens Guide"
[13]: https://developers.facebook.com/documentation/business-messaging/whatsapp/account-model-evolution "Updates to WhatsApp Business accounts"
[14]: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation "Embedded Signup implementation"
[15]: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider/ "Onboarding customers as a Tech Provider"
[16]: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/ "Create a webhook endpoint"
[17]: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview "WhatsApp webhooks"
[18]: https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/registration "Register a business phone number"
[19]: https://github.com/matiasbattocchia/open-bsp-api "OpenBSP API repository"
[20]: https://github.com/matiasbattocchia/open-bsp-api/blob/main/INTEGRATING.md "OpenBSP integration guide"
[21]: https://github.com/matiasbattocchia/open-bsp-ui "OpenBSP UI repository"
[22]: https://docs.github.com/en/actions/deployment/about-deployments/deploying-with-github-actions "Deploying with GitHub Actions"
[23]: https://vercel.com/docs/functions/limitations "Vercel Functions limitations"
[24]: https://vercel.com/docs/queues "Vercel Queues"
[25]: https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/ "Hostinger Node.js limits for Web and Cloud"
[26]: https://code.visualstudio.com/docs/agents/run/browser-tools "Use browser tools with agents in VS Code"
[27]: https://cursor.com/docs/agent/tools/browser "Browser tools in Cursor"
[28]: https://code.claude.com/docs/en/chrome "Claude Code with Chrome"
[29]: https://developers.openai.com/codex/ide "Codex IDE extension"
[30]: https://developers.openai.com/codex/mcp "MCP in Codex"
[31]: https://github.com/tashfeenahmed/freellmapi "FreeLLMAPI repository"
[32]: https://cursor.com/help/models-and-usage/api-keys "Cursor bring your own API key"
[33]: https://docs.nvidia.com/nim/large-language-models/latest/ai-assistant-integrations/codex-cli.html "NVIDIA NIM Codex CLI integration"
[34]: https://developer.amd.com/playbooks/lmstudio-rocm-llms/ "LM Studio on AMD Radeon"
[35]: https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices "MCP Security Best Practices"
[36]: https://code.visualstudio.com/docs/editing/workspaces/workspace-trust "Workspace Trust in VS Code"
[37]: https://developers.openai.com/codex/sandboxing "Codex sandboxing"
