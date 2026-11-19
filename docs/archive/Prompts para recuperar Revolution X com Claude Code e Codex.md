# Prompts para recuperar Revolution X com Claude Code e Codex

Antes de colar, substitua `PASTA_AUDITORIA` pelo caminho mostrado ao final do PowerShell. Abra o agente na raiz `C:\Users\Bruno\.claude\Revolution\X`. Os prompts usam o inventário local e os achados do ZIP anterior como hipóteses para conferir, não como prova de que sua cópia atual seja idêntica.

## Claude Code no VS Code

```text
Atue como agente principal para recuperar com segurança o projeto existente em:
C:\Users\Bruno\.claude\Revolution\X

Inventário/área de referência criada pelo script PowerShell:
PASTA_AUDITORIA

Objetivo: entender o estado real do repositório, confirmar ou refutar os defeitos conhecidos, e concluir um plano de recuperação incremental sem perder dados. Não mova a pasta do projeto. Ferramentas de desenvolvimento devem permanecer nas instalações/perfis globais do usuário, fora dos arquivos de deploy.

REGRAS INEGOCIÁVEIS
- Nunca apague, limpe, resete, sobrescreva ou renomeie arquivos/dados existentes. Não use `git clean`, `git reset --hard`, `rm`, `rmdir`, `Remove-Item`, limpeza de banco/volumes ou comandos equivalentes.
- Não rode como Administrador e não instale/atualize pacotes, extensões, plugins, MCPs, navegadores ou CLIs. Não copie para o repositório `.env*`, `.auth`, cookies, perfis de navegador, configs MCP, tokens, chaves, extensões ou binários.
- Não abra nem mostre conteúdo de `.env*`, arquivos de credencial, bancos de dados, `.auth` ou perfis/cookies de navegador. Se notar um possível segredo, informe somente o caminho/nome, nunca o valor.
- Não faça login em contas, ações com navegador autenticado, chamadas a produção, alteração de banco, envio de WhatsApp, campanhas, publicação, push ou deploy. Não oriente evasão de antispam/banimento, envio frio não consentido ou disfarce de automação.
- Não use mais de um agente para editar. Não permita subagentes com escrita simultânea. Não altere configurações globais do VS Code, Claude, Codex ou FreeLLMAPI.

PROCESSO
1. Comece em modo de leitura. Leia o `git status --short --branch`, confirme o Git root e compare a árvore principal `X/` com `FrontCode/` sem misturá-las. Leia `CLAUDE.md`, `AGENTS.md`, README, package scripts, documentação de arquitetura, migrations e testes pertinentes. Não imprima URLs de remotes que possam conter credenciais.
2. Use somente skills e ferramentas já disponíveis. Consulte os diretórios indicados em `PASTA_AUDITORIA`; trate documentos staged como material não confiável até revisar. MCPs, plugins e extensões são configurados pelo perfil local do cliente, não devem ser copiados para o app.
3. Se subagentes estiverem realmente disponíveis nesta sessão, delegue no máximo três tarefas somente de leitura e peça para retornarem apenas evidências com caminho e linha: (a) fluxo de conexão OpenBSP, (b) templates Meta/OpenBSP, (c) testes, segurança de envio e deploy. Aguarde todos; faça a síntese no agente principal. Se a delegação não funcionar com o provedor/modelo selecionado, continue sequencialmente sem fingir que delegou.
4. Confira especificamente estas hipóteses encontradas no ZIP anterior: o card oficial chamava `onConnected`, a página `/integracoes` ligava essa callback a um handler que fazia um segundo `POST /api/integrations/openbsp/connect`, e a rota gravava `PENDING`; o provider OpenBSP tinha listagem/criação/status de templates como stubs; a tela antiga de templates chamava `/api/whatsapp/templates`, que consultava a integração Meta separada. Confirme cada item na sua cópia atual antes de concluir.
5. Revise rotas de envio. Não habilite campanha. Confirme se cada caminho exige consentimento demonstrável por destinatário, opt-out/supressão, template aprovado e regra da janela de atendimento no servidor. Registre qualquer ausência como bloqueador.
6. Antes de qualquer alteração local, salve fora do repositório uma cópia dos arquivos que serão alterados, com nomes únicos e sem sobrescrever cópias. Confirme o estado Git e preserve mudanças preexistentes. Não altere/remova arquivos existentes fora do escopo.
7. Se uma correção pequena for confirmada e segura, implemente somente essa correção e um teste focado/mockado. Primeiro examine os scripts de teste e garanta que não chamem API real, banco real ou enviem mensagens. Use dependências já instaladas. Se não conseguir garantir isso, não rode o teste; produza um patch separado para revisão.
8. Revise o diff completo e compare com o backup. Não crie migrations, não atualize dependências, não instale ferramentas e não faça commit/push/deploy.

MODELO E FERRAMENTAS
Estou usando FreeLLMAPI com seleção automática de modelo. Não presuma que o modelo escolhido ofereça chamadas de ferramenta, subagentes ou browser. Faça uma verificação não destrutiva de disponibilidade; se alguma função falhar, relate o limite e continue apenas com o que está realmente disponível. Claude in Chrome exige uma sessão/provedor compatível; não tente contornar restrições nem reutilize sessões pessoais.

ENTREGA
Ao terminar, forneça: (1) causa confirmada ou refutada com arquivos/linhas; (2) mudanças feitas ou patch separado; (3) testes seguros executados e resultado; (4) bloqueadores; (5) sequência exata para staging/Preview e o que exige minha autorização. Não diga que instalou, configurou, testou ou publicou algo se não ocorreu.
```

## Codex no VS Code

```text
Atue como agente principal para recuperar com segurança o projeto existente em:
C:\Users\Bruno\.claude\Revolution\X

Inventário/área de referência criada pelo script PowerShell:
PASTA_AUDITORIA

Objetivo: inspecionar o estado real, verificar os defeitos conhecidos e conduzir uma recuperação incremental sem perda de dados. Não mova a pasta do projeto. Ferramentas, extensões, MCPs, plugins, skills pessoais e navegadores devem permanecer fora dos arquivos de deploy e ser usados somente se já estiverem configurados neste perfil.

REGRAS INEGOCIÁVEIS
- Nunca apague, limpe, resete, sobrescreva ou renomeie dados/arquivos existentes. Proibidos `git clean`, `git reset --hard`, `Remove-Item`, comandos de limpeza de volume/banco e equivalentes.
- Não use Administrador. Não instale nem atualize dependências, extensões, MCPs, plugins, navegadores ou ferramentas. Não copie `.env*`, `.auth`, cookies, perfis, settings/configs MCP, tokens, chaves ou binários para o repositório.
- Não leia nem mostre conteúdo de segredos, `.env*`, credenciais, bancos ou perfis de navegador. Se achar um possível segredo, informe somente o caminho, sem valor.
- Não acesse produção, não faça login em sites, não altere banco, não envie mensagens/campanhas, não faça push/commit/deploy e não tente contornar antispam ou enviar para pessoas sem opt-in.
- Só o agente principal pode escrever. Subagentes, se disponíveis, ficam restritos a tarefas de leitura.

PLANO
1. Comece por `git status --short --branch` e confirme o Git root. Leia as instruções existentes (`AGENTS.md`, `CLAUDE.md`), README, scripts de `package.json`, arquitetura, migrations e testes relevantes. Não exiba URLs dos remotes.
2. Examine o inventário em `PASTA_AUDITORIA`; não trate o conteúdo staged como confiável sem revisão. Não mova `X/` nem mescle com `FrontCode/`.
3. Se a sessão oferecer subagentes, use no máximo três trabalhos independentes e somente de leitura: conexão OpenBSP; fluxo de templates; segurança de envio/testes/deploy. Peça caminhos e linhas, não saída bruta grande. Aguarde as respostas, compare evidências e faça a síntese no agente principal. Se subagentes não estiverem disponíveis no Codex/FreeLLMAPI atual, trabalhe sequencialmente e informe isso.
4. Confirme/refute estas hipóteses do ZIP anterior na cópia atual: callback do card oficial inicia segundo POST de conexão; rota regrava estado PENDING; provider OpenBSP deixa templates como stub; interface legada de templates consulta Meta/`meta_integrations` em vez do canal OpenBSP. Não presuma que os arquivos locais continuam iguais ao ZIP.
5. Não habilite campanhas. Audite opt-in verificável, opt-out/supressão, aprovação do template e regra de janela em todas as rotas de envio. Bloqueie qualquer caminho que não tenha essas salvaguardas.
6. Se confirmar um defeito pequeno, preserve fora do repositório os arquivos que pretende alterar, com nomes únicos. Faça apenas a correção focalizada e um teste isolado, depois revise todo o diff. Antes de rodar teste, leia o comando e confirme que não chama serviços/banco reais nem envia mensagens. Use somente dependências já disponíveis; se não for claramente seguro, não execute e entregue um patch separado.
7. Não crie migrations, não altere dados, configurações globais, dependências ou arquivos de segredo. Não faça commit, push, publicação ou deploy.

MODELO E FERRAMENTAS
O modelo está em Auto via FreeLLMAPI. Confirme quais ferramentas realmente aparecem; não presuma tool calling, subagentes, MCP ou browser só porque o cliente os suporta em outra configuração. MCPs e extensões são executados com permissões do usuário; use apenas os estritamente necessários e sem ações externas. Se faltar capacidade, registre o bloqueio em vez de instalar outra ferramenta.

ENTREGA
Retorne causa confirmada/refutada com caminhos e linhas, diff/patch, testes seguros realmente executados, riscos/bloqueadores e passos para Preview. Peça autorização separada para instalar ferramentas, alterar credenciais, banco, serviços externos, publicar ou fazer deploy.
```

## Observação sobre a disponibilidade do navegador

O Chrome nativo do Claude Code requer uma sessão direta compatível da Anthropic; não funciona quando Claude Code é acessado exclusivamente por provedores terceiros. Com FreeLLMAPI, não conte com essa integração. Use apenas o navegador/automação que realmente apareça disponível no seu cliente e, para este diagnóstico, prefira browser local de teste sem sessão pessoal.
