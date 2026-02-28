import { useAuth } from "@/_core/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  User,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function AdminModeration() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: reports, isLoading } = trpc.admin.getReports.useQuery();
  const reviewMutation = trpc.admin.reviewReport.useMutation({
    onSuccess: () => {
      utils.admin.getReports.invalidate();
      toast.success("Denúncia revisada");
    },
  });
  const moderateMutation = trpc.admin.moderateUser.useMutation({
    onSuccess: () => {
      toast.success("Ação de moderação aplicada");
    },
  });

  // Mapa de ação por report id (evita estado compartilhado entre cards)
  const [selectedActions, setSelectedActions] = useState<Record<number, string>>({});

  // Aguarda resolução do estado de autenticação
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Controle de acesso: apenas admins
  if (!user || user.role !== "admin") {
    navigate("/");
    return null;
  }

  const handleReview = async (
    reportId: number,
    action: "resolved" | "dismissed"
  ) => {
    try {
      await reviewMutation.mutateAsync({ reportId, action });
    } catch (error: any) {
      toast.error(error.message || "Erro ao revisar denúncia");
    }
  };

  const handleModerate = async (
    reportId: number,
    userId: number,
    reason: string
  ) => {
    const action = selectedActions[reportId];
    if (!action) {
      toast.error("Selecione uma ação de moderação");
      return;
    }

    try {
      await moderateMutation.mutateAsync({
        userId,
        action: action as any,
        reason,
        duration: action === "suspend" ? 7 : undefined,
      });
      // Limpa a seleção do card após aplicar
      setSelectedActions((prev) => {
        const next = { ...prev };
        delete next[reportId];
        return next;
      });
    } catch (error: any) {
      toast.error(error.message || "Erro ao aplicar moderação");
    }
  };

  const pendingReports =
    reports?.filter((r: any) => r.status === "pending") || [];
  const reviewedReports =
    reports?.filter((r: any) => r.status !== "pending") || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pendente
          </Badge>
        );
      case "resolved":
        return (
          <Badge variant="default">
            <CheckCircle className="mr-1 h-3 w-3" />
            Resolvido
          </Badge>
        );
      case "dismissed":
        return (
          <Badge variant="outline">
            <XCircle className="mr-1 h-3 w-3" />
            Arquivado
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      harassment: "Assédio",
      spam: "Spam",
      inappropriate: "Conteúdo Inapropriado",
      other: "Outro",
    };
    return labels[reason] || reason;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Shield className="h-8 w-8 text-primary" />
                Painel de Moderação
              </h1>
              <p className="text-muted-foreground mt-2">
                Gerencie denúncias e aplique ações de moderação
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/admin")}>
              Voltar ao Admin
            </Button>
          </div>

          {/* Estatísticas */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Denúncias Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{pendingReports.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total de Denúncias
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{reports?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Revisadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{reviewedReports.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="pending" className="space-y-6">
            <TabsList>
              <TabsTrigger value="pending">
                Pendentes ({pendingReports.length})
              </TabsTrigger>
              <TabsTrigger value="reviewed">
                Revisadas ({reviewedReports.length})
              </TabsTrigger>
            </TabsList>

            {/* Denúncias Pendentes */}
            <TabsContent value="pending" className="space-y-4">
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  Carregando denúncias...
                </div>
              ) : pendingReports.length > 0 ? (
                <div className="space-y-4">
                  {pendingReports.map((report: any) => (
                    <Card key={report.id} className="border-yellow-200">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-yellow-600" />
                              Denúncia #{report.id}
                            </CardTitle>
                            <CardDescription>
                              {new Date(report.createdAt).toLocaleString("pt-BR")}
                            </CardDescription>
                          </div>
                          {getStatusBadge(report.status)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <div className="text-sm font-medium mb-1">
                              Denunciante
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <User className="h-4 w-4" />
                              Usuário #{report.reporterId}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium mb-1">
                              Usuário Denunciado
                            </div>
                            <div className="flex items-center gap-2 text-sm text-destructive">
                              <User className="h-4 w-4" />
                              Usuário #{report.reportedUserId}
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="text-sm font-medium mb-1">Motivo</div>
                          <Badge variant="outline">
                            {getReasonLabel(report.reason)}
                          </Badge>
                        </div>

                        {report.description && (
                          <div>
                            <div className="text-sm font-medium mb-1 flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Descrição
                            </div>
                            <p className="text-sm p-3 bg-muted rounded-lg">
                              {report.description}
                            </p>
                          </div>
                        )}

                        <div className="border-t pt-4 space-y-3">
                          <div className="text-sm font-medium">
                            Ações de Moderação
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Cada card tem seu próprio valor de seleção */}
                            <Select
                              value={selectedActions[report.id] ?? ""}
                              onValueChange={(val) =>
                                setSelectedActions((prev) => ({
                                  ...prev,
                                  [report.id]: val,
                                }))
                              }
                            >
                              <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Selecione ação" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="warning">
                                  Advertência
                                </SelectItem>
                                <SelectItem value="suspend">
                                  Suspender (7 dias)
                                </SelectItem>
                                <SelectItem value="ban">
                                  Banir Permanentemente
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              onClick={() =>
                                handleModerate(
                                  report.id,
                                  report.reportedUserId,
                                  `Denúncia #${report.id}: ${report.reason}`
                                )
                              }
                              disabled={
                                !selectedActions[report.id] ||
                                moderateMutation.isPending
                              }
                            >
                              Aplicar Ação
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 border-t pt-4">
                          <Button
                            onClick={() => handleReview(report.id, "resolved")}
                            disabled={reviewMutation.isPending}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Marcar como Resolvido
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleReview(report.id, "dismissed")}
                            disabled={reviewMutation.isPending}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Arquivar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Nenhuma denúncia pendente
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Denúncias Revisadas */}
            <TabsContent value="reviewed" className="space-y-4">
              {reviewedReports.length > 0 ? (
                <div className="space-y-4">
                  {reviewedReports.map((report: any) => (
                    <Card key={report.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-lg">
                              Denúncia #{report.id}
                            </CardTitle>
                            <CardDescription>
                              Criada em{" "}
                              {new Date(report.createdAt).toLocaleString(
                                "pt-BR"
                              )}
                              {report.reviewedAt && (
                                <>
                                  {" "}
                                  • Revisada em{" "}
                                  {new Date(report.reviewedAt).toLocaleString(
                                    "pt-BR"
                                  )}
                                </>
                              )}
                            </CardDescription>
                          </div>
                          {getStatusBadge(report.status)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid gap-4 md:grid-cols-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">
                              Denunciante:
                            </span>
                            <div className="font-medium">
                              Usuário #{report.reporterId}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Denunciado:
                            </span>
                            <div className="font-medium">
                              Usuário #{report.reportedUserId}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Motivo:
                            </span>
                            <div className="font-medium">
                              {getReasonLabel(report.reason)}
                            </div>
                          </div>
                        </div>
                        {report.description && (
                          <div className="text-sm p-3 bg-muted rounded-lg">
                            {report.description}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Nenhuma denúncia revisada
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
