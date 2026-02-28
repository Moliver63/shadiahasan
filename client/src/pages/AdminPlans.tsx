import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, DollarSign, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function AdminPlans() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number; name: string }>({
    open: false, id: 0, name: "",
  });

  const { data: plans, isLoading } = trpc.plans.listAll.useQuery();
  const utils = trpc.useUtils();

  const createPlan = trpc.plans.create.useMutation({
    onSuccess: () => {
      toast.success("Plano criado com sucesso!");
      utils.plans.listAll.invalidate();
      setIsCreateDialogOpen(false);
    },
    onError: (err) => toast.error("Erro ao criar plano: " + err.message),
  });

  const updatePlan = trpc.plans.update.useMutation({
    onSuccess: () => {
      toast.success("Plano atualizado com sucesso!");
      utils.plans.listAll.invalidate();
      setIsEditDialogOpen(false);
    },
    onError: (err) => toast.error("Erro ao atualizar plano: " + err.message),
  });

  const deletePlan = trpc.plans.delete.useMutation({
    onSuccess: () => {
      toast.success("Plano excluído com sucesso!");
      utils.plans.listAll.invalidate();
    },
    onError: (err) => toast.error("Erro ao excluir plano: " + err.message),
  });

  const handleCreatePlan = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createPlan.mutate({
      name: formData.get("name") as string,
      slug: formData.get("slug") as string,
      description: formData.get("description") as string,
      price: parseInt(formData.get("price") as string) * 100,
      interval: formData.get("interval") as "month" | "year",
      features: formData.get("features") as string,
      maxCourses: formData.get("maxCourses") ? parseInt(formData.get("maxCourses") as string) : undefined,
      hasVRAccess: formData.get("hasVRAccess") === "on" ? 1 : 0,
      hasLiveSupport: formData.get("hasLiveSupport") === "on" ? 1 : 0,
      isActive: 1,
    });
  };

  const handleUpdatePlan = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updatePlan.mutate({
      id: selectedPlan.id,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      price: parseInt(formData.get("price") as string) * 100,
      features: formData.get("features") as string,
      maxCourses: formData.get("maxCourses") ? parseInt(formData.get("maxCourses") as string) : undefined,
      hasVRAccess: formData.get("hasVRAccess") === "on" ? 1 : 0,
      hasLiveSupport: formData.get("hasLiveSupport") === "on" ? 1 : 0,
      isActive: formData.get("isActive") === "on" ? 1 : 0,
    });
  };

  const handleDeleteConfirmed = () => {
    deletePlan.mutate({ id: deleteConfirm.id });
    setDeleteConfirm({ open: false, id: 0, name: "" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto" />
          <p className="mt-4 text-gray-600">Carregando planos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Planos</h1>
          <p className="text-gray-600 mt-2">Gerencie os planos de assinatura da plataforma</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />Novo Plano
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans?.map((plan) => (
          <Card key={plan.id} className={!plan.isActive ? "opacity-60" : ""}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription className="mt-2">{plan.description}</CardDescription>
                </div>
                {!plan.isActive && (
                  <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">Inativo</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="text-2xl font-bold">R$ {(plan.price / 100).toFixed(2)}</span>
                  <span className="text-gray-600">/{plan.interval === "month" ? "mês" : "ano"}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <span>{plan.maxCourses ? `Até ${plan.maxCourses} cursos` : "Cursos ilimitados"}</span>
                  </div>
                  {plan.hasVRAccess === 1 && <div className="text-purple-600">✓ Acesso VR</div>}
                  {plan.hasLiveSupport === 1 && <div className="text-purple-600">✓ Suporte ao vivo</div>}
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline" size="sm" className="flex-1"
                    onClick={() => { setSelectedPlan(plan); setIsEditDialogOpen(true); }}
                  >
                    <Edit className="w-4 h-4 mr-1" />Editar
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setDeleteConfirm({ open: true, id: plan.id, name: plan.name })}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Confirmação de exclusão */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm(p => ({ ...p, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano "{deleteConfirm.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. Usuários com este plano ativo não serão afetados imediatamente,
              mas o plano deixará de estar disponível para novas assinaturas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleCreatePlan}>
            <DialogHeader>
              <DialogTitle>Criar Novo Plano</DialogTitle>
              <DialogDescription>Preencha os detalhes do novo plano de assinatura</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Nome do Plano</Label><Input name="name" placeholder="Premium" required /></div>
                <div><Label>Slug</Label><Input name="slug" placeholder="premium" required /></div>
              </div>
              <div><Label>Descrição</Label><Textarea name="description" placeholder="Acesso completo..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Preço (R$)</Label><Input name="price" type="number" step="0.01" placeholder="97.00" required /></div>
                <div>
                  <Label>Intervalo</Label>
                  <Select name="interval" defaultValue="month">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Mensal</SelectItem>
                      <SelectItem value="year">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Recursos (JSON)</Label><Textarea name="features" placeholder='["Recurso 1", "Recurso 2"]' /></div>
              <div><Label>Máximo de Cursos (vazio = ilimitado)</Label><Input name="maxCourses" type="number" /></div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" name="hasVRAccess" className="rounded" /><span>Acesso VR</span></label>
                <label className="flex items-center gap-2"><input type="checkbox" name="hasLiveSupport" className="rounded" /><span>Suporte ao Vivo</span></label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createPlan.isPending}>
                {createPlan.isPending ? "Criando..." : "Criar Plano"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleUpdatePlan}>
            <DialogHeader>
              <DialogTitle>Editar Plano</DialogTitle>
              <DialogDescription>Atualize os detalhes do plano</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div><Label>Nome</Label><Input name="name" defaultValue={selectedPlan?.name} required /></div>
              <div><Label>Descrição</Label><Textarea name="description" defaultValue={selectedPlan?.description || ""} /></div>
              <div><Label>Preço (R$)</Label><Input name="price" type="number" step="0.01" defaultValue={selectedPlan ? (selectedPlan.price / 100).toFixed(2) : ""} required /></div>
              <div><Label>Recursos (JSON)</Label><Textarea name="features" defaultValue={selectedPlan?.features || ""} /></div>
              <div><Label>Máximo de Cursos</Label><Input name="maxCourses" type="number" defaultValue={selectedPlan?.maxCourses || ""} /></div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" name="hasVRAccess" className="rounded" defaultChecked={selectedPlan?.hasVRAccess === 1} /><span>Acesso VR</span></label>
                <label className="flex items-center gap-2"><input type="checkbox" name="hasLiveSupport" className="rounded" defaultChecked={selectedPlan?.hasLiveSupport === 1} /><span>Suporte ao Vivo</span></label>
                <label className="flex items-center gap-2"><input type="checkbox" name="isActive" className="rounded" defaultChecked={selectedPlan?.isActive === 1} /><span>Ativo</span></label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={updatePlan.isPending}>
                {updatePlan.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
