/*
 * Política de Privacidade - Revolution X
 * Última atualização: 24 de outubro de 2026
 * Esta política descreve como coletamos, usamos e compartilhamos dados dos usuários
 * desta plataforma omnichannel multi-tenant.
 *
 * Esta política de privacidade foi gerada para atender aos requisitos da LGPD (Lei
 * Geral de Proteção de Dados - Lei nº 13.709/2018) e das diretrizes da Meta
 * (Facebook) para desenvolvedores de aplicativos.
 */

'use client';

import { useEffect } from 'react';

export default function PrivacyPolicyPage() {
  useEffect(() => {
    // Opcional: rastreamento de visualização de página para analytics
  }, []);

  return (
    <main className="min-h-screen bg-[#05020A] text-white p-8">
      <div className="max-w-3xl mx-auto">
        <nav className="mb-6">
          <a href="/" className="text-white text-opacity-60 hover:text-white transition">
            ← Voltar ao início
          </a>
        </nav>

        <h1 className="text-3xl font-bold text-white mb-6">Política de Privacidade</h1>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">1. Informações Gerais</h2>
          <p className="text-white text-opacity-60">
            Bem-vindo ao Revolution X. Esta política de privacidade explica como coletamos,
            usamos e compartilhamos suas informações quando você usa nossa plataforma
            omnichannel para gestão de campanhas, CRM, WhatsApp e integrações de IA.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">2. Informações que Coletamos</h2>
          <ul className="list-disc list-inside text-white text-opacity-60 space-y-2">
            <li>
              <strong>Dados de Cadastro:</strong> Nome, e-mail, senha, número de telefone,
              ao criar uma conta na plataforma.
            </li>
            <li>
              <strong>Dados de Organização:</strong> Nome da organização, slug, informações
              de configuração multi-tenant.
            </li>
            <li>
              <strong>Dados de Contato:</strong> E-mails, telefones (incluindo WhatsApp),
              perfis de redes sociais fornecidos pelos usuários.
            </li>
            <li>
              <strong>Conteúdo do Usuário:</strong> Mensagens, arquivos, mídias e dados
              trocados através das integrações da plataforma.
            </li>
            <li>
              <strong>Dados de Uso:</strong> Informações sobre como a plataforma é usada,
              páginas visitadas, recursos acessados, horários de uso.
            </li>
            <li>
              <strong>Integrações Meta/Instagram/WhatsApp:</strong> Tokens de acesso,
              IDs de contas, perfis e dados fornecidos pelas APIs da Meta.
            </li>
            <li>
              <strong>Dados de IA:</strong> Prompts, configurações de provedores de IA,
              histórico de gerações (quando aplicável).
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">3. Como Usamos Seus Dados</h2>
          <ul className="list-disc list-inside text-white text-opacity-60 space-y-2">
            <li>
              <strong>Operação da Plataforma:</strong> Para fornecer, manter e melhorar
              nossos serviços de CRM, campanhas, WhatsApp e automação.
            </li>
            <li>
              <strong>Segurança:</strong> Para detectar, prevenir e lidar com atividades
              não autorizadas, fraudes ou violações dos Termos de Serviço.
            </li>
            <li>
              <strong>IA e Automação:</strong> Para alimentar recursos de IA (Gemini,
              OpenAI, provedores configurados) e automações configuradas pelos usuários.
            </li>
            <li>
              <strong>Comunicação:</strong> Para enviar notificações, e-mails (via SMTP),
              SMS ou mensagens sobre a conta e os serviços.
            </li>
            <li>
              <strong>Análises:</strong> Para entender como a plataforma é usada e
              melhorar a experiência do usuário (utilizamos dados agregados e anonimizados).
            </li>
            <li>
              <strong>Conformidade Legal:</strong> Para cumprir obrigações legais,
              regulamentações (LGPD) e requisitos da Meta para desenvolvedores de apps.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">4. Compartilhamento de Dados</h2>
          <p className="text-white text-opacity-60 mb-4">
            Não vendemos seus dados a terceiros. Podemos compartilhar informações nas
            seguintes situações:
          </p>
          <ul className="list-disc list-inside text-white text-opacity-60 space-y-2">
            <li>
              <strong>Provedores de Serviço:</strong> Com empresas que nos ajudam a
              operar a plataforma (hosting, banco de dados, envios de e-mail, análise),
              sob obrigações de confidencialidade.
            </li>
            <li>
              <strong>Legal Obrigatório:</strong> Quando exigido por lei, regulamentação
              ou ordem judicial.
            </li>
            <li>
              <strong>Meta:</strong> Dados necessários para conformidade com as políticas
              e requisitos de desenvolvedores da Meta, incluindo integrações
              WhatsApp, Instagram e login.
            </li>
            <li>
              <strong>Transação Empresarial:</strong> Em caso de fusão, aquisição ou
              venda de parte dos nossos ativos, onde os dados do usuário podem ser
              transferidos ao novo proprietário.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">5. Retenção de Dados</h2>
          <p className="text-white text-opacity-60 mb-4">
            Mantemos seus dados pelo tempo necessário para: (1) fornecer nossos serviços,
            (2) cumprir obrigações legais, (3) resolver disputas e (4) fazer cumprir
            nossos Termos de Serviço.
          </p>
          <ul className="list-disc list-inside text-white text-opacity-60 space-y-2">
            <li>Dados de cadastro: enquanto a conta estiver ativa</li>
            <li>Conteúdo do usuário: indefinido, até exclusão pelo usuário</li>
            <li>Logs de uso: 30 dias a 2 anos, dependendo do tipo</li>
            <li>Tokens Meta: enquanto ativos/connnected</li>
            <li>Dados de backup: conforme política de backup da infraestrutura</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">6. Seus Direitos (LGPD)</h2>
          <p className="text-white text-opacity-60 mb-4">
            Em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018),
            você tem os seguintes direitos:
          </p>
          <ul className="list-disc list-inside text-white text-opacity-60 space-y-2">
            <li>
              <strong>Acesso:</strong> Solicitar uma cópia dos dados que temos sobre você.
            </li>
            <li>
              <strong>Correção:</strong> Solicitar a correção de dados incompletos ou
              inexatos.
            </li>
            <li>
              <strong>Exclusão:</strong> Solicitar a exclusão dos seus dados pessoais.
            </li>
            <li>
              <strong>Portabilidade:</strong> Solicitar que enviemos seus dados a outro
              controlador, em formato estruturado.
            </li>
            <li>
              <strong>Oposição:</strong> Oposição ao tratamento de dados em certas
              circunstâncias.
            </li>
            <li>
              <strong>Limitação:</strong> Solicitar a limitação do tratamento de seus
              dados.
            </li>
          </ul>
          <p className="text-white text-opacity-60 mt-4">
            Para exercer quaisquer destes direitos, entre em contato conosco através
            do e-mail privacidade@revolutionx.com.br ou pelo formulário de contato
            na plataforma.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">7. Segurança dos Dados</h2>
          <p className="text-white text-opacity-60">
            Implementamos medidas de segurança técnicas e organizacionais para proteger
            seus dados contra acesso não autorizado, alteração, divulgação ou destruição.
            Estas incluem:
          </p>
          <ul className="list-disc list-inside text-white text-opacity-60 space-y-2">
            <li>Criptografia de dados em trânsito (TLS/SSL) e em repouso</li>
            <li>Controle de acesso baseado em função (RLS) por organização</li>
            <li>Autenticação segura com sessão Supabase/GoTrue</li>
            <li>Monitoramento de segurança e logs de acesso</li>
            <li>Políticas de senha e MFA opcionais</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">8. Links para Outros Sites</h2>
          <p className="text-white text-opacity-60">
            Nossa plataforma pode conter links para sites de terceiros, incluindo
            plataformas da Meta (Facebook, Instagram, WhatsApp). Não nos responsabilizamos
            pelas práticas de privacidade desses sites ou aplicativos. Incentivamos
            que leia as políticas de privacidade de quaisquer sites de terceiros que
            visitar.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4">8. Alterações nesta Política</h2>
          <p className="text-white text-opacity-60">
            Podemos atualizar nossa política de privacidade de tempos em tempos.
            Notificaremos sobre mudanças significativas publicando a nova política
            nesta página e, quando apropriado, enviaremos um e-mail ou notificação
            dentro da plataforma. Recomendamos que reveja periodicamente esta página
            para estar ciente de quaisquer alterações.
          </p>
        </section>

        <footer className="mt-8 pt-8 border-t border-white/10 text-white text-opacity-60">
          <p>
            © {new Date().getFullYear()} Revolution X. Todos os direitos reservados.
          </p>
          <p className="mt-1 text-xs text-white text-opacity-50">
            Esta política de privacidade foi atualizada pela última vez em
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