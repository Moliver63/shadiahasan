import { Link } from "wouter";
import SiteLogo from "@/components/SiteLogo";
import { SEOHead } from "@/components/SEOHead";
import { getSEOMetaTags } from "@/lib/seo-meta-tags";

export default function Terms() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100">
      <SEOHead {...getSEOMetaTags("/terms")} />
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <SiteLogo className="h-36 w-auto cursor-pointer" />
          </Link>
          <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">
            Voltar para Home
          </Link>
        </div>
      </header>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Termos de Uso</h1>
          <p className="text-sm text-gray-600 mb-8">Última atualização: 18 de novembro de 2026</p>

          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Aceitação dos Termos</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Ao acessar e utilizar a plataforma Shadia Hasan ("Plataforma"), você concorda em cumprir e estar vinculado aos presentes Termos de Uso. Se você não concordar com qualquer parte destes termos, não deverá utilizar nossos serviços.
              </p>
              <p className="text-gray-700 leading-relaxed">
                A Plataforma é operada por Shadia Hasan, psicóloga inscrita no CRP 12/27052, e oferece programas de desenvolvimento pessoal, cursos online, conteúdos em realidade virtual e serviços relacionados à psicologia e desenvolvimento humano.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Descrição dos Serviços</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                A Plataforma oferece acesso a conteúdos educacionais, cursos, programas de transformação pessoal, experiências em realidade virtual, ebooks, certificados e uma comunidade de conexões conscientes. Os serviços são disponibilizados mediante diferentes planos de assinatura (Gratuito, Básico, Premium e VIP) ou compra individual de programas.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Reservamo-nos o direito de modificar, suspender ou descontinuar qualquer aspecto da Plataforma a qualquer momento, mediante aviso prévio aos usuários quando aplicável.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Cadastro e Conta do Usuário</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Para acessar determinados recursos da Plataforma, você deve criar uma conta fornecendo informações precisas, completas e atualizadas. Você é responsável por manter a confidencialidade de sua senha e por todas as atividades que ocorram em sua conta.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Você concorda em notificar imediatamente a Plataforma sobre qualquer uso não autorizado de sua conta. Não nos responsabilizamos por perdas decorrentes do uso não autorizado de sua conta.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Você deve ter pelo menos 18 anos de idade para criar uma conta. Ao se cadastrar, você declara que possui capacidade legal para celebrar este contrato.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Planos e Pagamentos</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                A Plataforma pode oferecer planos de assinatura mensal com diferentes níveis de acesso e a compra individual de programas, conforme o que estiver disponível no momento. Os valores e benefícios estão descritos na página de cada programa e na página de preços. Os pagamentos são processados por parceiros de pagamento (Asaas e Stripe); a Plataforma não armazena dados de cartão.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                As assinaturas são renovadas automaticamente no final de cada período de cobrança, a menos que você cancele antes da data de renovação. Você pode cancelar sua assinatura a qualquer momento através das configurações de sua conta.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Não oferecemos reembolsos para períodos de assinatura já pagos, exceto conforme exigido por lei.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>Compra individual de programas.</strong> Na compra individual, o pagamento é único (Pix, cartão de crédito ou boleto, conforme as formas disponíveis), sem mensalidade e sem renovação automática. O acesso ao programa comprado é liberado na sua conta assim que o pagamento é confirmado pelo parceiro de pagamento e é vitalício, enquanto a Plataforma estiver em funcionamento. A compra de um programa não dá acesso aos demais programas nem a benefícios de assinatura. Materiais de presente informados na página do programa fazem parte da compra.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>Direito de arrependimento.</strong> Você pode desistir da compra de um programa em até 7 (sete) dias contados da confirmação do pagamento, com devolução integral do valor, conforme o artigo 49 do Código de Defesa do Consumidor. Basta escrever para contato@shadiahasan.com. Após o reembolso, o acesso ao programa é encerrado. Em caso de contestação do pagamento junto ao banco ou à operadora do cartão, o acesso fica suspenso até a conclusão da contestação.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>Mudança na forma de venda.</strong> A Plataforma pode alternar entre a venda por assinatura e a venda individual de programas. Essa mudança não cancela assinaturas vigentes, não altera cobranças já feitas e não retira o acesso a programas já comprados.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Reservamo-nos o direito de alterar os preços dos planos mediante aviso prévio de 30 dias. As alterações não afetarão o período de cobrança atual.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Propriedade Intelectual</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Todo o conteúdo disponível na Plataforma, incluindo textos, vídeos, áudios, imagens, gráficos, logotipos, ícones, software e experiências em realidade virtual, é de propriedade exclusiva de Shadia Hasan ou de seus licenciadores e está protegido pelas leis de direitos autorais e propriedade intelectual.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Você recebe uma licença limitada, não exclusiva, intransferível e revogável para acessar e usar o conteúdo exclusivamente para fins pessoais e não comerciais. É expressamente proibido copiar, reproduzir, distribuir, modificar, exibir publicamente, criar obras derivadas ou explorar comercialmente qualquer conteúdo sem autorização prévia por escrito.
              </p>
              <p className="text-gray-700 leading-relaxed">
                A violação dos direitos de propriedade intelectual pode resultar no cancelamento imediato de sua conta e em medidas legais cabíveis.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Uso Aceitável</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Ao utilizar a Plataforma, você concorda em não: (a) violar qualquer lei ou regulamento aplicável; (b) infringir direitos de terceiros; (c) transmitir conteúdo ofensivo, difamatório, obsceno ou ilegal; (d) tentar obter acesso não autorizado a sistemas ou redes; (e) interferir no funcionamento da Plataforma; (f) usar a Plataforma para fins comerciais não autorizados; (g) fazer engenharia reversa ou descompilar qualquer parte da Plataforma.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Reservamo-nos o direito de suspender ou encerrar sua conta caso você viole estas regras de uso aceitável.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Comunidade e Interações</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                A Plataforma oferece recursos de comunidade, incluindo conexões entre usuários e sistema de mensagens. Ao participar, você concorda em tratar outros membros com respeito e civilidade.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Não toleramos assédio, discriminação, discurso de ódio ou qualquer forma de abuso. Você pode denunciar comportamentos inadequados através do sistema de moderação. Reservamo-nos o direito de remover conteúdo, suspender ou banir usuários que violem nossas diretrizes de comunidade.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Você é responsável por todas as comunicações e conteúdos que compartilha na Plataforma. Não nos responsabilizamos por interações entre usuários.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Isenção de Responsabilidade</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Os conteúdos e programas oferecidos na Plataforma têm caráter educacional e de desenvolvimento pessoal. Não substituem atendimento psicológico, psiquiátrico ou médico profissional individualizado.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                A Plataforma é fornecida "como está" e "conforme disponível", sem garantias de qualquer tipo, expressas ou implícitas. Não garantimos que a Plataforma será ininterrupta, livre de erros ou segura.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Não nos responsabilizamos por danos diretos, indiretos, incidentais, consequenciais ou punitivos decorrentes do uso ou incapacidade de usar a Plataforma.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Limitação de Responsabilidade</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Na máxima extensão permitida por lei, nossa responsabilidade total perante você por quaisquer danos decorrentes ou relacionados a estes Termos ou ao uso da Plataforma não excederá o valor pago por você nos últimos 12 meses.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Algumas jurisdições não permitem a exclusão de certas garantias ou limitação de responsabilidade por danos consequenciais. Nesses casos, nossa responsabilidade será limitada na máxima extensão permitida por lei.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Modificações dos Termos</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Reservamo-nos o direito de modificar estes Termos de Uso a qualquer momento. Notificaremos você sobre alterações significativas por e-mail ou através de aviso na Plataforma.
              </p>
              <p className="text-gray-700 leading-relaxed">
                O uso continuado da Plataforma após a publicação das alterações constitui sua aceitação dos novos termos. Se você não concordar com as modificações, deverá encerrar sua conta.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Rescisão</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Você pode encerrar sua conta a qualquer momento através das configurações da Plataforma. Reservamo-nos o direito de suspender ou encerrar sua conta imediatamente, sem aviso prévio, caso você viole estes Termos.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Após o encerramento, seu direito de acessar a Plataforma cessará imediatamente. Disposições que por sua natureza devam sobreviver ao encerramento permanecerão em vigor.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Lei Aplicável e Jurisdição</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Estes Termos serão regidos e interpretados de acordo com as leis da República Federativa do Brasil. Qualquer disputa decorrente destes Termos será submetida à jurisdição exclusiva dos tribunais brasileiros.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Contato</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Se você tiver dúvidas sobre estes Termos de Uso, entre em contato conosco:
              </p>
              <div className="bg-purple-50 p-6 rounded-lg">
                <p className="text-gray-700 mb-2"><strong>Shadia Hasan</strong></p>
                <p className="text-gray-700 mb-2">CRP: 12/27052</p>
                <p className="text-gray-700 mb-2">E-mail: contato@shadiahasan.com</p>
                <p className="text-gray-700">WhatsApp: +55 47 99142-6662</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
