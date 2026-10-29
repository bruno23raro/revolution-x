# RX_DOC_DEPENDENCIAS_OFICIAIS_20261027 — Dependências Oficiais do Meta

## Tabela Completa de Dependências do Meta (15 relações)

Todas as permissões do Meta têm relações de dependência documentadas. Abaixo a tabela completa:

| Permissão Principal | Permissões Dependentes | Direção da Dependência |
|---------------------|------------------------|------------------------|
| `business_management` | `pages_read_engagement` | business_management -> pages_read_engagement (Meta aceita pages_read_engagement quando business_management está declarado) |
| `business_management` | `pages_show_list` | business_management -> pages_show_list |
| `instagram_basic` | `pages_read_user_content` | instagram_basic -> pages_read_user_content |
| `instagram_basic` | `pages_show_list` | instagram_basic -> pages_show_list |
| `instagram_content_publish` | `instagram_basic` | instagram_content_publish -> instagram_basic |
| `instagram_content_publish` | `pages_read_engagement` | instagram_content_publish -> pages_read_engagement |
| `instagram_content_publish` | `pages_show_list` | instagram_content_publish -> pages_show_list |
| `instagram_branded_content_ads_brand` | `instagram_basic` | instagram_branded_content_ads_brand -> instagram_basic |
| `instagram_branded_content_ads_brand` | `pages_read_engagement` | instagram_branded_content_ads_brand -> pages_read_engagement |
| `instagram_branded_content_ads_brand` | `pages_show_list` | instagram_branded_content_ads_brand -> pages_show_list |
| `ads_management` | `pages_read_engagement` | ads_management -> pages_read_engagement |
| `ads_management` | `pages_show_list` | ads_management -> pages_show_list |
| `catalog_management` | `business_management` | catalog_management -> business_management |
| `pages_messaging` | `pages_show_list` | pages_messaging -> pages_show_list |
| `pages_manage_metadata` | (nenhuma dependência documentada) | — |

## Como usar esta tabela no formulário de review

1. **Declare a permissão principal** — na descrição do use case, indique claramente qual é a permissão principal solicitada
2. **Liste as dependências** — ao declarar uma permissão principal, também declare quaisquer permissões dependentes que ela exige
3. **Justificativa Meta** — o Meta aceita permissões dependentes quando a permissão principal é declarada no use case. A regra é: "Se business_management entrar como dependência, o Meta permite declarar a permissão principal na descrição do use case."

## Aplicação ao nosso scope de 11 permissões

Nosso pacote solicita 11 permissões com as seguintes dependências ativas:

### Level A (7 permissões — independentes ou drivers)
| Permissão | Dependências | Observação |
|-----------|-------------|-----------|
| `whatsapp_business_messaging` | Nenhuma (driver Level A) | Core WhatsApp messaging — solicitada diretamente |
| `business_management` | Nenhuma (driver Level A) | Habilita dependências Level B — driver principal |
| `ads_read` | Nenhuma (Level A pura) | Ads insights — solicitada diretamente |
| `pages_show_list` | Nenhuma (Level A pura) | Page listing — solicitada diretamente |
| `instagram_basic` | `pages_read_user_content`, `pages_show_list` | Dependências ativas — inserir no doc |
| `instagram_content_publish` | `instagram_basic`, `pages_read_engagement`, `pages_show_list` | 3 dependências ativas — inserir no doc |
| `pages_manage_posts` | `pages_show_list` | Dependência de page listing — inserir no doc |

### Level B (3 permissões — dependentes)
| Permissão | Dependência Principal | Justificativa |
|-----------|----------------------|---------------|
| `pages_read_engagement` | `business_management` | Meta aceita com declaração de use case de business_management |
| `pages_manage_ads` | (nenhuma obrigatória, mas definida em constants) | Level B opcional — call recording recomendado |
| `pages_read_user_content` | `instagram_basic` | Dependência de instagram_basic — inserir no doc |
| `whatsapp_business_management` | `whatsapp_business_messaging` | Dependência de whatsapp_business_messaging — inserir no doc |

## Instruções para o Doc de Cada Permissão

Em cada arquivo `RX_DOC_<permissao>.md`, a Seção 1 (USE CASE DESCRIPTION) deve incluir:

1. A permissão principal sendo solicitada
2. Todas as permissões dependentes listadas, com justificativa de por que elas são necessárias
3. A declaração de que o Meta aceita essas dependências quando a permissão principal é declarada
4. O caso de uso concreto no app Revolution X

Exemplo para `instagram_content_publish`:
> "Solicitando `instagram_content_publish` com dependências `instagram_basic`, `pages_read_engagement` e `pages_show_list`. Essas permissões são dependências oficiais do Meta: `instagram_content_publish` exige `instagram_basic` como base, e ambas concedem acesso a `pages_read_engagement` e `pages_show_list` como métricas auxiliares. No Revolution X, `instagram_content_publish` é usado para criar e publicar posts de foto e vídeo no feed do Instagram Business, e as dependências são necessárias para o fluxo completo de autorização e exibição de métricas de engajamento."

## Resumo das 15 Relações de Dependência

As 15 relações de dependência oficial do Meta formam uma rede onde:
- `business_management` é o driver máximo (abilita 2 permissões dependentes)
- `instagram_basic` é a base para `instagram_content_publish` (2 dependências)
- `instagram_content_publish` é o mais dependente (3 dependências)
- `ads_management`, `catalog_management`, `pages_messaging`, `pages_manage_metadata` têm dependências menores

Para o nosso pacote de 11 permissões, as dependências ativas são:
- `business_management` -> `pages_read_engagement`, `pages_show_list`
- `instagram_basic` -> `pages_read_user_content`, `pages_show_list`
- `instagram_content_publish` -> `instagram_basic`, `pages_read_engagement`, `pages_show_list`
- `whatsapp_business_management` -> `whatsapp_business_messaging`

Total: 8 relações de dependência ativas em nosso scope.