# REVOLUTION X — INSTRUÇÃO DE MEMÓRIA

Antes de trabalhar neste projeto, leia `REVOLUTION_X_MEMORY.md`.

Se o usuário disser `REVOLVER`, trate isso como comando para:
- recuperar o contexto persistente;
- ler a memória;
- verificar o estado atual do Git;
- continuar de onde o trabalho parou;
- não reiniciar tarefas já concluídas.

## REGRAS DE AUTONOMIA PERMANENTE

Não interrompa o trabalho para pedir autorização a cada etapa, comando, arquivo ou decisão técnica reversível.

Quando receber um objetivo:
- Analise o estado atual antes de alterar qualquer coisa.
- Monte um plano e execute as etapas em sequência.
- Inspecione arquivos, Git, dependências, scripts, logs e ambiente.
- Corrija erros encontrados e continue até concluir o objetivo ou esgotar as alternativas viáveis.
- Tome decisões técnicas razoáveis com base nas evidências existentes.
- Instale ou ajuste dependências locais quando necessário e permitido, verificando compatibilidade e impactos.

## LIMITES OBRIGATÓRIOS DE SEGURANÇA

### Banco de Dados
- Nunca execute migrations, DDL, exclusões, resets ou testes destrutivos contra produção.
- Nunca utilize `DATABASE_URL`, `DIRECT_URL` ou credenciais do Supabase como fallback para `TEST_DATABASE_URL`.
- Antes de alterar um banco, verifique a identidade do servidor, o nome do banco e o ambiente de destino.
- Execute migrations automaticamente somente em ambientes comprovadamente locais, isolados e destinados a testes, desde que não exista risco relevante de perda de dados.

### Segredos e Dados
- Nunca imprima, copie para relatórios ou exponha senhas, tokens, chaves privadas ou valores secretos de `.env`, `.env.local` e arquivos equivalentes.
- Não enfraqueça autenticação, autorização, isolamento multi-tenant ou políticas RLS para fazer os testes passarem.

### Sistema e Serviços Externos
- Não contorne permissões do sistema, autenticação, MFA, OAuth ou mecanismos de aprovação.
- Não altere domínios, DNS, produção, faturamento ou serviços externos com impacto relevante sem a autorização exigida pelo próprio sistema.

## GIT E INTEGRIDADE DO PROJETO
- Consulte `git status` e os diffs antes de mudanças relevantes.
- Preserve alterações preexistentes.
- Não execute `git reset --hard`, `git clean -fd`, descarte indiscriminado de arquivos ou comandos equivalentes destrutivos.
- Não sobrescreva trabalho do usuário sem necessidade.

## REGRA PARA BLOQUEIOS
Se uma etapa ficar bloqueada:
1. Registre o erro exato sem revelar segredos.
2. Investigue a causa.
3. Tente alternativas seguras e materialmente diferentes.
4. Continue as demais tarefas independentes.
5. Evite repetir tentativas idênticas sem mudança de condições.
6. Só peça ajuda ao usuário quando a próxima ação realmente depender dele.
