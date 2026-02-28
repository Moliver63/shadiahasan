import { Link } from "wouter";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <img 
              src="/logo.png" 
              alt="Shadia Hasan" 
              className="h-36 w-auto cursor-pointer"
            />
          </Link>
          <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">
            Voltar para Home
          </Link>
        </div>
      </header>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Política de Privacidade</h1>
          <p className="text-sm text-gray-600 mb-8">Última atualização: 16 de fevereiro de 2026</p>

          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introdução</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                A Shadia Hasan ("nós", "nosso" ou "Plataforma") está comprometida em proteger a privacidade e os dados pessoais de seus usuários. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e compartilhamos suas informações pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018) e demais legislações aplicáveis.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Ao utilizar nossa Plataforma, você concorda com as práticas descritas nesta Política. Se você não concordar com qualquer parte desta Política, não deverá utilizar nossos serviços.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Controlador de Dados</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Para fins da LGPD, o controlador de dados é:
              </p>
              <div className="bg-purple-50 p-6 rounded-lg mb-4">
                <p className="text-gray-700 mb-2"><strong>Shadia Hasan</strong></p>
                <p className="text-gray-700 mb-2">CRP: 12/27052</p>
                <p className="text-gray-700 mb-2">E-mail: contato@shadiahasan.club</p>
                <p className="text-gray-700 mb-2">WhatsApp: +55 47 99142-6662</p>
                <p className="text-gray-700">Website: shadiahasan.club</p>
              </div>
              <p className="text-gray-700 leading-relaxed">
                Você pode entrar em contato conosco para exercer seus direitos de titular de dados ou esclarecer dúvidas sobre esta Política.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Dados Pessoais Coletados</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Coletamos diferentes tipos de dados pessoais dependendo de como você interage com nossa Plataforma:
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-3">3.1. Dados Fornecidos Diretamente por Você</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Quando você cria uma conta, coletamos: nome completo, endereço de e-mail, senha (armazenada de forma criptografada), foto de perfil (opcional), preferências de idioma e notificações. Ao realizar pagamentos, coletamos informações de cobrança através da plataforma Stripe, que processa os dados de pagamento de forma segura.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-3">3.2. Dados Coletados Automaticamente</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Ao utilizar a Plataforma, coletamos automaticamente: endereço IP, tipo de navegador, sistema operacional, páginas visitadas, tempo de permanência, cursos acessados, progresso de aprendizagem, aulas concluídas, certificados obtidos, interações com conteúdo em realidade virtual, cookies e tecnologias similares.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-3">3.3. Dados de Autenticação Social</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Se você optar por fazer login através de Google ou Apple, coletamos: nome, e-mail, foto de perfil e identificador único fornecidos pelo provedor de autenticação. Não temos acesso à sua senha desses serviços.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-3">3.4. Dados da Comunidade</h3>
              <p className="text-gray-700 leading-relaxed">
                Se você participar da comunidade "Conexões Conscientes", coletamos: biografia pública, objetivos de desenvolvimento, cursos de interesse, mensagens trocadas com outros usuários e conexões estabelecidas.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Finalidades do Tratamento de Dados</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Utilizamos seus dados pessoais para as seguintes finalidades, com base legal na LGPD:
              </p>

              <div className="overflow-x-auto mb-4">
                <table className="min-w-full bg-white border border-gray-200">
                  <thead className="bg-purple-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 border-b">Finalidade</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 border-b">Base Legal (LGPD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="px-6 py-4 text-sm text-gray-700">Criar e gerenciar sua conta</td>
                      <td className="px-6 py-4 text-sm text-gray-700">Execução de contrato (Art. 7º, V)</td>
                    </tr>
                    <tr className="border-b bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-700">Processar pagamentos e assinaturas</td>
                      <td className="px-6 py-4 text-sm text-gray-700">Execução de contrato (Art. 7º, V)</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-6 py-4 text-sm text-gray-700">Fornecer acesso a cursos e conteúdos</td>
                      <td className="px-6 py-4 text-sm text-gray-700">Execução de contrato (Art. 7º, V)</td>
                    </tr>
                    <tr className="border-b bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-700">Acompanhar progresso e emitir certificados</td>
                      <td className="px-6 py-4 text-sm text-gray-700">Execução de contrato (Art. 7º, V)</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-6 py-4 text-sm text-gray-700">Enviar e-mails transacionais (verificação, recuperação de senha)</td>
                      <td className="px-6 py-4 text-sm text-gray-700">Execução de contrato (Art. 7º, V)</td>
                    </tr>
                    <tr className="border-b bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-700">Enviar e-mails promocionais e newsletters</td>
                      <td className="px-6 py-4 text-sm text-gray-700">Consentimento (Art. 7º, I)</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-6 py-4 text-sm text-gray-700">Facilitar conexões entre usuários na comunidade</td>
                      <td className="px-6 py-4 text-sm text-gray-700">Consentimento (Art. 7º, I)</td>
                    </tr>
                    <tr className="border-b bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-700">Melhorar a Plataforma e personalizar experiência</td>
                      <td className="px-6 py-4 text-sm text-gray-700">Legítimo interesse (Art. 7º, IX)</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-6 py-4 text-sm text-gray-700">Prevenir fraudes e garantir segurança</td>
                      <td className="px-6 py-4 text-sm text-gray-700">Legítimo interesse (Art. 7º, IX)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm text-gray-700">Cumprir obrigações legais e regulatórias</td>
                      <td className="px-6 py-4 text-sm text-gray-700">Obrigação legal (Art. 7º, II)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Compartilhamento de Dados</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Não vendemos seus dados pessoais a terceiros. Compartilhamos seus dados apenas nas seguintes situações:
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-3">5.1. Prestadores de Serviços</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Compartilhamos dados com prestadores de serviços que nos auxiliam a operar a Plataforma: Stripe (processamento de pagamentos), Resend (envio de e-mails transacionais), Cloudflare Stream (hospedagem de vídeos), Amazon S3 (armazenamento de arquivos), Google e Apple (autenticação OAuth). Esses prestadores são contratualmente obrigados a proteger seus dados e utilizá-los apenas para as finalidades especificadas.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-3">5.2. Requisições Legais</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Podemos divulgar seus dados se exigido por lei, ordem judicial, processo legal ou solicitação governamental, ou para proteger nossos direitos, propriedade ou segurança.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-3">5.3. Transferência de Negócio</h3>
              <p className="text-gray-700 leading-relaxed">
                Em caso de fusão, aquisição ou venda de ativos, seus dados podem ser transferidos. Você será notificado sobre qualquer mudança de controle.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Armazenamento e Segurança</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Implementamos medidas técnicas e organizacionais apropriadas para proteger seus dados contra acesso não autorizado, alteração, divulgação ou destruição. Isso inclui: criptografia de dados em trânsito (HTTPS/TLS) e em repouso, senhas armazenadas com hash bcrypt, controles de acesso baseados em funções, monitoramento de segurança e logs de auditoria, backups regulares e plano de recuperação de desastres.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Seus dados são armazenados em servidores seguros localizados nos Estados Unidos e Brasil. Quando há transferência internacional de dados, garantimos que existam salvaguardas adequadas conforme exigido pela LGPD.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Embora nos esforcemos para proteger seus dados, nenhum método de transmissão pela internet ou armazenamento eletrônico é 100% seguro. Não podemos garantir segurança absoluta.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Retenção de Dados</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Retemos seus dados pessoais apenas pelo tempo necessário para cumprir as finalidades descritas nesta Política, salvo se um período de retenção maior for exigido ou permitido por lei.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Dados de conta ativa são retidos enquanto sua conta estiver ativa. Após o encerramento da conta, dados essenciais são mantidos por 5 anos para cumprimento de obrigações legais (fiscais, contratuais). Dados de pagamento são retidos conforme exigências fiscais e contratuais. Logs de acesso e segurança são mantidos por até 6 meses. Dados anonimizados podem ser retidos indefinidamente para fins estatísticos.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Você pode solicitar a exclusão antecipada de seus dados a qualquer momento, sujeito às obrigações legais de retenção.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Seus Direitos como Titular de Dados</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                De acordo com a LGPD, você possui os seguintes direitos em relação aos seus dados pessoais:
              </p>

              <div className="bg-purple-50 p-6 rounded-lg mb-4">
                <ul className="space-y-3">
                  <li className="text-gray-700"><strong>Confirmação e acesso:</strong> Confirmar a existência de tratamento e acessar seus dados</li>
                  <li className="text-gray-700"><strong>Correção:</strong> Corrigir dados incompletos, inexatos ou desatualizados</li>
                  <li className="text-gray-700"><strong>Anonimização, bloqueio ou eliminação:</strong> Solicitar anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade</li>
                  <li className="text-gray-700"><strong>Portabilidade:</strong> Solicitar a portabilidade de seus dados a outro fornecedor</li>
                  <li className="text-gray-700"><strong>Eliminação:</strong> Solicitar a eliminação de dados tratados com base em consentimento</li>
                  <li className="text-gray-700"><strong>Informação sobre compartilhamento:</strong> Obter informações sobre entidades com as quais compartilhamos seus dados</li>
                  <li className="text-gray-700"><strong>Revogação de consentimento:</strong> Revogar o consentimento a qualquer momento</li>
                  <li className="text-gray-700"><strong>Oposição:</strong> Opor-se ao tratamento realizado com base em legítimo interesse</li>
                </ul>
              </div>

              <p className="text-gray-700 leading-relaxed">
                Para exercer seus direitos, entre em contato conosco através do e-mail contato@shadiahasan.club. Responderemos à sua solicitação em até 15 dias, podendo ser prorrogado por mais 15 dias mediante justificativa.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Cookies e Tecnologias Similares</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Utilizamos cookies e tecnologias similares para melhorar sua experiência na Plataforma. Cookies são pequenos arquivos de texto armazenados no seu dispositivo.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-3">9.1. Tipos de Cookies Utilizados</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>Cookies essenciais:</strong> Necessários para o funcionamento da Plataforma (autenticação, segurança). Não podem ser desabilitados.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>Cookies de desempenho:</strong> Coletam informações sobre como você usa a Plataforma para melhorar seu funcionamento.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>Cookies de funcionalidade:</strong> Lembram suas preferências e escolhas.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mb-3">9.2. Gerenciamento de Cookies</h3>
              <p className="text-gray-700 leading-relaxed">
                Você pode gerenciar ou desabilitar cookies através das configurações do seu navegador. Note que desabilitar cookies pode afetar a funcionalidade da Plataforma.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Privacidade de Menores</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Nossa Plataforma não é direcionada a menores de 18 anos. Não coletamos intencionalmente dados pessoais de menores sem o consentimento dos pais ou responsáveis legais.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Se tomarmos conhecimento de que coletamos dados de um menor sem consentimento adequado, tomaremos medidas para excluir essas informações o mais rápido possível.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Alterações nesta Política</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Podemos atualizar esta Política de Privacidade periodicamente para refletir mudanças em nossas práticas ou por razões legais, regulatórias ou operacionais.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Notificaremos você sobre alterações significativas por e-mail ou através de aviso destacado na Plataforma. A data da última atualização será sempre indicada no topo desta Política. Recomendamos que você revise esta Política periodicamente.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Legislação Aplicável</h2>
              <p className="text-gray-700 leading-relaxed">
                Esta Política de Privacidade é regida pela Lei Geral de Proteção de Dados (Lei nº 13.709/2018), pelo Marco Civil da Internet (Lei nº 12.965/2014) e demais legislações brasileiras aplicáveis à proteção de dados pessoais.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Contato e Encarregado de Dados</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Se você tiver dúvidas sobre esta Política de Privacidade, quiser exercer seus direitos como titular de dados ou reportar uma preocupação de privacidade, entre em contato conosco:
              </p>
              <div className="bg-purple-50 p-6 rounded-lg">
                <p className="text-gray-700 mb-2"><strong>Shadia Hasan</strong></p>
                <p className="text-gray-700 mb-2">Encarregado de Proteção de Dados (DPO)</p>
                <p className="text-gray-700 mb-2">CRP: 12/27052</p>
                <p className="text-gray-700 mb-2">E-mail: contato@shadiahasan.club</p>
                <p className="text-gray-700 mb-2">WhatsApp: +55 47 99142-6662</p>
                <p className="text-gray-700">Website: shadiahasan.club</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
