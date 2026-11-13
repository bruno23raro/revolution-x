# Design — Revolution X

## 1. Principios
Denso, direto, sem enfeite. Estado vazio sempre com acao. Erro sempre com o que fazer.

## 2. Tokens
<!-- PREENCHER com os tokens reais do tailwind.config: cor primaria, raio, sombra, espacamento -->

## 3. Componentes do modulo WhatsApp
| Componente | Estados obrigatorios |
|---|---|
| WhatsAppOfficialCard | carregando, desconectado, conectando, conectado, erro |
| WhatsAppQrCard | gerando, aguardando leitura, expirado, conectado, erro |
| Lista de conversas | vazio, carregando, erro, com itens |
| Composer | desabilitado sem sessao, enviando, falha com retry |

## 4. Copy de erro
- Sem sessao: "Conecte um numero para enviar mensagens."
- Falha de envio: "Nao foi possivel enviar. Tentar de novo."
- Template rejeitado: "A Meta rejeitou este template. Veja o motivo."

## 5. Acessibilidade
Foco visivel, contraste AA, aria-live em status de conexao, alvo de toque 44px.

## 6. Anti-padroes
- Card que parece conectado sem estar.
- Spinner eterno sem timeout.
- Erro tecnico cru na tela.