import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, DollarSign, User } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getBreadcrumbs } from "@/lib/breadcrumbs";

export default function AdminCashbackRequests() {
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [actionDialog, setActionDialog] = useState<"approve" | "reject" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const utils = trpc.useUtils();

  // Query
  const { data: requests, isLoading } = trpc.referrals.listCashbackRequests.useQuery(
    statusFilter === "all" ? undefined : { status: statusFilter }
  );

  // Mutations
  const processRequest = trpc.referrals.processCashbackRequest.useMutation({
    onSuccess: () => {
      toast.success("Solicitação processada com sucesso!");
      utils.referrals.listCashbackRequests.invalidate();
      setActionDialog(null);
      setSelectedRequest(null);
      setAdminNotes("");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao processar solicitação");
    },
  });

  const handleApprove = () => {
    if (!selectedRequest) return;
    processRequest.mutate({
      requestId: selectedRequest.id,
      status: "approved",
      adminNotes,
    });
  };

  const handleReject = () => {
    if (!selectedRequest) return;
    if (!adminNotes.trim()) {
      toast.error("Por favor, adicione uma justificativa para rejeição");
      return;
    }
    processRequest.mutate({
      requestId: selectedRequest.id,
      status: "rejected",
      adminNotes,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><CheckCircle2 className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "pix":
        return "PIX";
      case "bank_transfer":
        return "Transferência Bancária";
      case "credit_account":
        return "Crédito na Conta";
      default:
        return method;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumbs items={getBreadcrumbs('/admin/cashback-requests')} />

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Solicitações de Cashback</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie e aprove solicitações de resgate de pontos
          </p>
        </div>

        {/* Filter */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="w-64">
                <Label>Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value: any) => setStatusFilter(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="rejected">Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Requests List */}
        <Card>
          <CardHeader>
            <CardTitle>Solicitações</CardTitle>
            <CardDescription>
              {requests?.length || 0} solicitação(ões) encontrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : requests && requests.length > 0 ? (
              <div className="space-y-4">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold">{request.userName}</p>
                          <p className="text-sm text-muted-foreground">{request.userEmail}</p>
                        </div>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Pontos</p>
                        <p className="font-semibold">{request.pointsAmount} pts</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Valor</p>
                        <p className="font-semibold text-green-600">R$ {request.cashAmount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Método</p>
                        <p className="font-semibold text-sm">{getPaymentMethodLabel(request.paymentMethod)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Data</p>
                        <p className="font-semibold text-sm">
                          {new Date(request.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>

                    {request.paymentMethod === "pix" && request.pixKey && (
                      <div className="mb-3 p-2 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs text-blue-700 font-medium">Chave PIX:</p>
                        <p className="text-sm font-mono text-blue-900">{request.pixKey}</p>
                      </div>
                    )}

                    {request.paymentMethod === "bank_transfer" && request.bankDetails && (
                      <div className="mb-3 p-2 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs text-blue-700 font-medium">Dados Bancários:</p>
                        <p className="text-sm text-blue-900 whitespace-pre-wrap">{request.bankDetails}</p>
                      </div>
                    )}

                    {request.adminNotes && (
                      <div className="mb-3 p-2 bg-gray-50 rounded border">
                        <p className="text-xs text-gray-700 font-medium">Notas do Admin:</p>
                        <p className="text-sm text-gray-900">{request.adminNotes}</p>
                      </div>
                    )}

                    {request.status === "pending" && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            setSelectedRequest(request);
                            setActionDialog("approve");
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedRequest(request);
                            setActionDialog("reject");
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Rejeitar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma solicitação encontrada
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Dialog */}
        <Dialog open={actionDialog !== null} onOpenChange={() => {
          setActionDialog(null);
          setSelectedRequest(null);
          setAdminNotes("");
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionDialog === "approve" ? "Aprovar Solicitação" : "Rejeitar Solicitação"}
              </DialogTitle>
              <DialogDescription>
                {actionDialog === "approve"
                  ? "Confirme a aprovação desta solicitação de cashback"
                  : "Adicione uma justificativa para a rejeição"}
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Usuário:</span>
                    <span className="font-medium">{selectedRequest.userName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Pontos:</span>
                    <span className="font-medium">{selectedRequest.pointsAmount} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Valor:</span>
                    <span className="font-medium text-green-600">R$ {selectedRequest.cashAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Método:</span>
                    <span className="font-medium">{getPaymentMethodLabel(selectedRequest.paymentMethod)}</span>
                  </div>
                </div>

                <div>
                  <Label>Notas do Admin {actionDialog === "reject" && <span className="text-red-500">*</span>}</Label>
                  <Textarea
                    placeholder={
                      actionDialog === "approve"
                        ? "Adicione observações (opcional)"
                        : "Explique o motivo da rejeição"
                    }
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setActionDialog(null);
                  setSelectedRequest(null);
                  setAdminNotes("");
                }}
              >
                Cancelar
              </Button>
              <Button
                variant={actionDialog === "approve" ? "default" : "destructive"}
                onClick={actionDialog === "approve" ? handleApprove : handleReject}
                disabled={processRequest.isPending}
              >
                {processRequest.isPending ? "Processando..." : actionDialog === "approve" ? "Confirmar Aprovação" : "Confirmar Rejeição"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
