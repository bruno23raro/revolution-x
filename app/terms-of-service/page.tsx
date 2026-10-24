/*
 * Termos de Serviço - Revolution X
 * Ultima atualizacao: 24 de outubro de 2026
 * Estes termos regulam o uso da plataforma Revolution X, um sistema omnichannel
 * multi-tenant para gestao de campanhas, CRM, WhatsApp, integracoes de IA e
 * automacao de marketing.
 *
 * Estes Termos de Servico foram desenvolvidos para atender aos requisitos da Meta
 * (Facebook) para desenvolvedores de aplicativos e estao em conformidade com
 * a legislao brasileira, incluindo a LGPD (Lei nº 13.709/2018) e o CDC
 * (Codigo de Defesa do Consumidor) para aspectos relevantes.
 */

'use client';

import { useEffect } from 'react';

export default function TermsOfServicePage() {
  useEffect(() => {
    // Opcional: rastreamento de visualizacao de pagina
  }, []);

  return (
    <main className="min-h-screen bg-[#05020A] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <nav className="mb-6">
          <a href="/" className="text-white text-opacity-60 hover:text-white transition">
            &larr; Voltar ao inicio
          </a>
        </nav>

        <h1 className="text-3xl font-bold text-white mb-6">Termos de Servico</h1>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">1. Aceite destes Termos</h2>
          <p className="text-white text-opacity-60">
            Ao acessar ou usar a plataforma Revolution X, voce concorda com estes
            Termos de Servico. Se voce nao concorda com alguma parte destes Termos,
            nao deve acessar ou usar a Plataforma.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">2. Definicoes</h2>
          <p className="text-white text-opacity-60">
            Abaixo, definimos os termos usados nestes Termos:
          </p>
          <ul className="list-disc list-inside text-white text-opacity-60 space-y-2">
            <li>
              <strong>Plataforma:</strong> A aplicacao Revolution X, incluindo seu site,
              painel de administracao, APIs, integracoes (WhatsApp, Instagram, Meta)
              e todos os recursos de CRM, campanhas, automacao e IA.
            </li>
            <li>
              <strong>Usuario:</strong> Qualquer pessoa que acesse a Plataforma, seja
              como visitante, cliente, administrador ou titular de conta.
            </li>
            <li>
              <strong>Conta:</strong> O perfil de usuario registrado na Plataforma,
              com credenciais de acesso (e-mail/senha) e associacao a uma organizacao.
            </li>
            <li>
              <strong>Organizacao:</strong> Uma entidade (empresa, ONV, individuo) que
              possui uma conta na Plataforma e pode ter multiplos usuarios e assinaturas.
            </li>
            <li>
              <strong>Conteudo:</strong> Qualquer dado, texto, imagem, video, audio,
              mensagem ou outra informacao inserida, carregada ou transmitida atraves
              da Plataforma pelo Usuario.
            </li>
            <li>
              <strong>IA:</strong> Recursos de inteligencia artificial (Gemini, OpenAI,
              provedores configurados) disponiveis na Plataforma.
            </li>
            <li>
              <strong>Campos Obrigatorios:</strong> Informacoes necessarias para o
              funcionamento da conta e da organizacao.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">3. Conta e Registro</h2>
          <ul className="list-disc list-inside text-white text-opacity-60 space-y-2">
            <li>
              <strong>Elegibilidade:</strong> Para criar uma Conta, voce deve ter a
              capacidade juridica de celebrar contratos vinculantes sob a legistlacao
              aplicavel e nao ser proibido de usar a Plataforma sob leis aplicaveis.
            </li>
            <li>
              <strong>Informacoes Corretas:</strong> Voce concorda fornecer informacoes
              verdadeiras, precisas e atuais durante o registro e manter tais
              informacoes atualizadas. Reservamo-nos o direito de solicitar verificacao
              de identidade.
            </li>
            <li>
              <strong>Seguranca da Conta:</strong> Voce e responsavel por manter a
              seguranca da sua senha e informacoes de conta. Notifique-nos imediatamente
              sobre qualquer acesso nao autorizado ou violacao de seguranca da sua conta.
            </li>
            <li>
              <strong>Uma Conta por Organizacao:</strong> Geralmente, uma organizacao
              deve ter apenas uma Conta na Plataforma. Podemos autorizar multiplas
              Contas para organizacoes maiores sob solicitacao e acordo separado.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">4. Uso da Plataforma</h2>
          <p className="text-white text-opacity-60 mb-4">
            Ao usar a Plataforma, voce concorda em:
          </p>
          <ul className="list-disc list-inside text-white text-opacity-60 space-y-2">
            <li>
              <strong>Utilizar a Plataforma:</strong> apenas para fins legais e de
              acordo com estes Termos.
            </li>
            <li>
              <strong>Nao Violar Direitos:</strong> nao violar quaisquer direitos
              autorais, direitos de propriedade intelectual, direitos de privacidade
              ou outros direitos de terceiros.
            </li>
            <li>
              <strong>Nao Postar Conteudo Ilícito:</strong> nao enviar, receber,
              publicar ou transmitir qualquer conteudo que seja ilicito, difamatorio,
              obsceno, ofensivo, abusivo ou que incentive a violencia.
            </li>
            <li>
              <strong>Nao Infringir Seguranca:</strong> nao tentar obter acesso
              nao autorizado à conta, ao sistema ou a informacoes de terceiros
              atraves de meios de hacking, password mining ou outros meios.
            </li>
            <li>
              <strong>Respeitar RLS:</strong> respeitar o isolamento multi-tenant e
              nao acessar dados de outras organizacoes atraves da Plataforma.
            </li>
            <li>
              <strong>Uso Responsavel da IA:</strong> usar os recursos de IA de
              maneira responsavel, nao gerando conteudo ilicito, prejudicial ou
              que viole direitos de terceiros.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">5. Conteudo do Usuario</h2>
          <p className="text-white text-opacity-60 mb-4">
            Voce possui todo o Conteudo que, de sua autoria, disponibiliza, posta,
            publica ou exibe na Plataforma ("Seu Conteudo"). Ao disponibilizar,
            postar, publicar ou exibir Seu Conteudo na Plataforma, voce nos concede
            uma licenca mundial, nao exclusiva, royalty-free, transferivel e
            sublincenciavel para usar, reproduzir, modificar, exibir, executar,
            distribuir e divulgar esse Conteudo em conexao com a Plataforma.
            Voce nos concede esta licenca apenas para tanto quanto for necessario
            para operar e fornecer a Plataforma. Voce declara e garante que voce
            possui ou controla todos os direitos sobre o Seu Conteudo.
          </p>
          <p className="text-white text-opacity-60 mt-4">
            Voce e responsavel pelo Seu Conteudo e concorda em indenizar, defender
            e isentar de responsabilidade a Revolution X, seus afiliados e
            licenciadores contra qualquer reclamacao, demanda ou reivindicacao
            decorrente ou relacionada ao Seu Conteudo ou ao seu uso da Plataforma.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">6. Propriedade Intelectual</h2>
          <p className="text-white text-opacity-60">
            A Plataforma, seu conteudo original (exceto Conteudo do Usuario), nomes,
            marcas, logotipos e software sao de propriedade da Revolution X ou de
            seus licenciadores. Voce nao possui nenhum direito sobre tais materiais.
            Voce concorda nao copiar, reproduzir, modificar, publicar, carregar,
            postar, transmitir ou distribuir qualquer parte da Plataforma sem
            nossa previa autorizacao escrita expressa.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">7. IA e Recursos de Automação</h2>
          <p className="text-white text-opacity-60 mb-4">
            Os recursos de IA (Gemini, provedores configurados) e automacao
            disponiveis na Plataforma sao fornecidos "COMO ESTAO" e "CONFORME
            DISPONIVEL". Nao garantimos que:
          </p>
          <ul className="list-disc list-inside text-white text-opacity-60 space-y-2">
            <li>Os servicos de IA nao serao interrompidos ou serao permanentes.</li>
            <li>Os resultados da IA serao precisos, confiaveis ou livres de erros.</li>
            <li>Os recursos de IA atenderao suas necessidades ou expectativas.</li>
            <li>Serra ser possivel usar a Plataforma em combinacao com os recursos de IA.</li>
          </ul>
          <p className="text-white text-opacity-60 mt-4">
            Voce e responsavel pelo uso dos recursos de IA e pelo conteudo gerado
            por eles. Voce concorda em nao usar recursos de IA para:
          </p>
          <ul className="list-disc list-inside text-white text-opacity-60 space-y-2">
            <li>Gerar conteudo ilicito, prejudicial ou que viole direitos de terceiros.</li>
            <li>Contornar medidas de seguranca da Plataforma.</li>
            <li>Criar perfis falsos ou se passar por outras pessoas.</li>
            <li>Violar os presentes Termos ou qualquer lei aplicavel.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">8. Privacidade</h2>
          <p className="text-white text-opacity-60">
            O tratamento de dados pessoais realizados atraves da Plataforma esta
            regido por nossa <a href="/privacy-policy" className="text-white text-opacity-60 hover:text-white">
              Politica de Privacidade
            </a>. Ao usar a Plataforma, voce concorda com o tratamento de dados
            conforme descrito nessa politica.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">8. Links para Outros Sites</h2>
          <p className="text-white text-opacity-60">
            A Plataforma pode conter links para sites de terceiros, incluindo
            plataformas da Meta (Facebook, Instagram, WhatsApp). Nao nos responsabilizamos
            pelas praticas de privacidade, conteudo ou qualquer outro aspecto desses
            sites ou aplicativos. Incentivamos que leia as politicas e termos de
            quaisquer sites de terceiros que visitar.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">9. Limitação de Responsabilidade</h2>
          <p className="text-white text-opacity-60">
            Na medida maxima permitida por lei aplicavel, nem a Revolution X, nem
            seus diretores, funcionarios, agentes, parceiros, afiliados,
            contratantes ou licenciadores serao responsaveis por quaisquer danos
            indiretos, incidentais, especiais, consequenciais ou punitivos,
            incluindo perda de lucros, dados ou outros prejuizos resultantes do
            uso ou incapacidade de usar a Plataforma, de quaisquer Conteudos
            postados na Plataforma, ou de outra forma decorrentes do uso da
            Plataforma, quer com base em garantia, contrato, dano (incluindo
            negligencia) ou outra teoria legal, mesmo que tenhamos sido informados
            da possibilidade de tais danos. Na medida maxima permitida por lei,
            nossa responsabilidade total decorrente do uso da Plataforma nao
            excedera o valor de R$ 100,00 (cem reais) pago por voce nos ultimos
            30 (trinta) dias.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">10. Indenização</h2>
          <p className="text-white text-opacity-60">
            Voce concorda indenizar, defender e isentar de responsabilidade a
            Revolution X, seus diretores, funcionarios, agentes, parceiros,
            afiliados, contratantes e licenciadores de e contra quaisquer
            perdas, danos, reivindicacoes e despesas (incluindo honorarios
            advocaticios) decorrentes ou decorrentes do seu uso da Plataforma,
            do Seu Conteudo, do seu incumprimento destes Termos, ou da sua
            violacao de qualquer lei ou direito de terceiro.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">11. Rescisão</h2>
          <p className="text-white text-opacity-60">
            A Revolution X pode rescindir ou suspender seu acesso à Plataforma,
            por qualquer motivo ou sem motivo, a qualquer momento, com ou sem
            aviso prévio. Voce pode rescindir estes Termos a qualquer momento
            excluindo sua conta e deixando de usar a Plataforma. Ao rescindir,
            suas obrigações sob as seções sobre Propriedade Intelectual, Privacidade,
            Indenização e Limitação de Responsabilidade sobreviverão a tais
            rescisão. As provisionais referentes a cobrança, se houver, também
            sobreviverão.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">12. Lei Aplicável e Foro</h2>
          <p className="text-white text-opacity-60">
            Estes Termos serão regidos e interpretados de acordo com as leis do
            Brasil, sem regard a seus conflitos de disposições legais. Qualquer
    controvérsia decorrente ou relacionada a estes Termos será submetida aos
            Tribunais competentes do Rio de Janeiro, Brasil, salvo disposição
            em contrário nestes Termos.
          </p>
        </section>

        <footer className="mt-8 pt-8 border-t border-white/10 text-white text-opacity-60">
          <p>
            © {new Date().getFullYear()} Revolution X. Todos os direitos reservados.
          </p>
          <p className="mt-1 text-xs text-white text-opacity-50">
            Termos de Serviço atualizados pela última vez em
            {new Date().toLocaleDateString('pt-BR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}.
          </p>
        </footer>
      </div>
    </main>
  );
}