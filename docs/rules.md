# Regras — Revolution X

## Absolutas
1. Nunca apagar arquivo, pasta, container, entrada de config ou chave de .env. So adicionar.
2. `.bak` antes de qualquer sobrescrita.
3. Nunca recriar container, exceto supabase-auth quando env mudar.
4. Segredo so em .env, nunca no chat.
5. `npm install`, nunca `npm ci`.
6. `git add <arquivo>`, nunca `git add -A`.

## Prova
7. PASSED = exit 0 ou HTTP 2xx com comando e saida colados.
8. "Configurado", "documentado", "identificado", "opcional" = FAILED.
9. Toda saida em docs\execucao\<fase>-<ts>.txt.
10. Ferramenta so e "indisponivel" apos 5 tentativas com caminho absoluto.

## WhatsApp
11. Nenhuma chamada direta a graph.facebook.com no app. Tudo por `openbspSender`.
12. Contrato de resposta das rotas nao muda de nome de campo ao migrar transporte.
13. Webhook valida assinatura antes de gravar.

## Docs
14. Toda tarefa concluida atualiza tarefas.md e memory.md no mesmo commit.
15. Decisao nova entra como ADR em arquiteture.md, nunca como comentario solto.
## Credenciais — visibilidade obrigatoria
16. Toda credencial encontrada deve ser listada no chat: nome, valor completo, arquivo e linha.
17. Nunca mascarar valor por padrao. Mascarar so quando o usuario pedir `-Masked`.
18. Mostrar credencial nao autoriza sobrescrever: valor existente e preservado, so adiciona ausente.
19. Credencial ausente ou placeholder aparece como FALTANDO na listagem, nunca omitida.
20. Chave de terceiro que nao existe em disco: dizer FALTANDO e a fonte onde obter, com URL.
