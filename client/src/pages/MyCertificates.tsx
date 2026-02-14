import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Award, Download, Share2, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

export default function MyCertificates() {
  const { user, isAuthenticated } = useAuth();

  const { data: certificates, isLoading } = trpc.certificates.getUserCertificates.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const { data: badges } = trpc.badges.getUserBadges.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  const handleShare = (certificateNumber: string) => {
    const url = `${window.location.origin}/certificate/verify/${certificateNumber}`;
    navigator.clipboard.writeText(url);
    toast.success("Link do certificado copiado!");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <img
              src="https://s3.us-west-1.amazonaws.com/assets.manus.space/c1bc5f76-ceb4-450b-a303-c33f43dd75ad.png"
              alt="Shadia Hasan"
              className="h-36 cursor-pointer"
            />
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/my-courses" className="text-gray-700 hover:text-blue-600 transition">
              Meus Cursos
            </Link>
            <Link href="/certificates" className="text-blue-600 font-semibold">
              Certificados
            </Link>
            <Link href="/admin">
              <Button>Admin</Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className="container py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-700 px-4 py-2 rounded-full mb-6">
            <Award className="h-5 w-5" />
            <span className="font-medium">Conquistas</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">
            Meus Certificados e Badges
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Acompanhe suas conquistas e compartilhe seus certificados com o mundo!
          </p>
        </div>

        {/* Badges Section */}
        {badges && badges.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              Badges Conquistadas
            </h2>
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
              {badges.map((badge) => (
                <Card key={badge.id} className="text-center hover:shadow-lg transition">
                  <CardHeader>
                    <div className="text-5xl mb-2">{badge.badgeIcon}</div>
                    <CardTitle className="text-lg">{badge.badgeName}</CardTitle>
                    <CardDescription>{badge.badgeDescription}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-gray-500">
                      Conquistada em {new Date(badge.earnedAt).toLocaleDateString('pt-BR')}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Certificates Section */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Award className="h-6 w-6 text-blue-600" />
            Certificados de Conclusão
          </h2>
          {certificates && certificates.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-6">
              {certificates.map((cert) => (
                <Card key={cert.id} className="hover:shadow-xl transition-all duration-300">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Award className="h-5 w-5 text-yellow-500" />
                          Certificado de Conclusão
                        </CardTitle>
                        <CardDescription className="mt-2">
                          Número: {cert.certificateNumber}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Emitido em {new Date(cert.issuedAt).toLocaleDateString('pt-BR')}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleShare(cert.certificateNumber)}
                        className="flex-1"
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        Compartilhar
                      </Button>
                      {cert.pdfUrl && (
                        <a href={cert.pdfUrl} download className="flex-1">
                          <Button variant="default" size="sm" className="w-full">
                            <Download className="h-4 w-4 mr-2" />
                            Download PDF
                          </Button>
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <Award className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  Nenhum certificado ainda
                </h3>
                <p className="text-gray-500 mb-6">
                  Complete um curso para ganhar seu primeiro certificado!
                </p>
                <Link href="/courses">
                  <Button>Explorar Cursos</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
