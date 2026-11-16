# Fontes oficiais consultadas — escopos de ferramentas de coding agents

Consultado em 14 nov. 2026 para responder sobre Claude Code, Codex, VS Code, skills/MCP/plugins e browser.

- Anthropic, skills Claude Code: https://code.claude.com/docs/en/skills — `SKILL.md` em escopo pessoal/projeto; `--add-dir` carrega skills/commands/agents de diretórios adicionais; projeto pode compartilhar/commitar skills, portanto não é ideal para arquivos pessoais de deploy.
- Anthropic, MCP Claude Code: https://code.claude.com/docs/en/mcp — escopos local, project (`.mcp.json`) e user (`~/.claude.json`); project scope pode ir ao versionamento e entra no limite de confiança; variáveis de ambiente podem referenciar segredos, então não se deve copiar configuração de MCP para o repo sem revisão.
- Anthropic, subagentes: https://code.claude.com/docs/en/sub-agents — agentes pessoais em `~/.claude/agents/`, de projeto em `.claude/agents/`, em Markdown com YAML frontmatter; arquivos de projeto podem ser versionados.
- Anthropic, plugins: https://code.claude.com/docs/en/plugins/overview — plugins podem incluir skills, agentes, hooks e MCP; hooks/MCP executam dentro das sessões e com permissões do usuário; instalar indiscriminadamente amplia contexto e processos.
- Anthropic, Claude in Chrome: https://code.claude.com/docs/en/chrome — requer Chrome/Edge/Chromium e extensão compatível; integração não funciona através de provedores de terceiros se Claude Code é acessado exclusivamente por eles; exige autenticação direta compatível.
- OpenAI, Codex skills: https://developers.openai.com/codex/build-skills — skills em repo `.agents/skills/` e em perfil usuário `$HOME/.agents/skills`; diretórios podem incluir instruções/scripts; skills com plugins podem adicionar MCP.
- OpenAI, Codex MCP: https://developers.openai.com/codex/mcp — configuração padrão `~/.codex/config.toml`; configuração `.codex/config.toml` de projeto só para projetos confiáveis; `codex mcp list` mostra os servidores existentes.
- OpenAI, Codex AGENTS.md: https://developers.openai.com/codex/agent-configuration/agents-md — `~/.codex/AGENTS.md` global e `AGENTS.md` por projeto, carregados hierarquicamente.
- OpenAI, Codex subagentes: https://learn.chatgpt.com/docs/agent-configuration/subagents — releases atuais do Codex descrevem workflows de subagentes, mas delegação paralela consome mais tokens e escrita concorrente exige cautela.
- VS Code, segurança para IA: https://code.visualstudio.com/docs/agents/run/security — recomenda Workspace Trust para projetos não confiáveis, revisão de MCP/extensões e permissões, sandbox de agente; extensões/MCP podem executar código e acessar dados locais sob privilégios do usuário.

Conclusão aplicada: skills e instruções podem ficar em locais reconhecidos por cada cliente, fora da pasta que vai para deploy; MCPs, plugins, extensões, navegador e suas credenciais são configurações/instalações por usuário e não devem ser movidos para o repositório. Inventário local não deve ler valores de `.env`, tokens, cookies ou perfis de navegador.
