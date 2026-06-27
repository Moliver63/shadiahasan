import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calendar, Clock, User, MapPin, Plus, ChevronLeft, ChevronRight,
  Edit, Trash2, Loader2, CheckCircle2, XCircle, AlertCircle, Eye
} from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: "Agendado",       color: "text-blue-700",  bg: "bg-blue-100"  },
  confirmed: { label: "Confirmado",     color: "text-green-700", bg: "bg-green-100" },
  completed: { label: "Concluído",      color: "text-gray-700",  bg: "bg-gray-100"  },
  cancelled: { label: "Cancelado",      color: "text-red-700",   bg: "bg-red-100"   },
  no_show:   { label: "Não Compareceu", color: "text-orange-700",bg: "bg-orange-100"},
};

const PROGRAM_TYPES = [
  "Sessão Individual",
  "Sessão em Grupo",
  "Consulta Inicial",
  "Acompanhamento",
  "Workshop",
  "Outro",
];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(date: string | Date) {
  return new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// Gera dias do mês para o calendário
function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

export default function AdminAppointments() {
  const today = new Date();
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Dialogs
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [selected, setSelected] = useState<any>(null);

  // Form state
  const emptyForm = { userId: "", title: "", description: "", programType: "", startTime: "", endTime: "", duration: 60, location: "", notes: "", status: "scheduled" };
  const [form, setForm] = useState(emptyForm);

  const { data: appointments = [], refetch, isLoading } = trpc.appointments.listAll.useQuery(
    statusFilter !== "all" ? { status: statusFilter as any } : undefined,
    { staleTime: 0, refetchOnMount: "always" }
  );
  const { data: users = [] } = trpc.admin.listUsers.useQuery();

  const createMutation = trpc.appointments.create.useMutation({
    onSuccess: () => { refetch(); toast.success("Sessão criada!"); setShowCreate(false); setForm(emptyForm); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.appointments.update.useMutation({
    onSuccess: () => { refetch(); toast.success("Sessão atualizada!"); setShowEdit(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.appointments.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Sessão removida."); setConfirmDelete(null); },
    onError: (e) => toast.error(e.message),
  });

  function openEdit(apt: any) {
    setSelected(apt);
    setForm({
      userId: String(apt.userId),
      title: apt.title,
      description: apt.description ?? "",
      programType: apt.programType ?? "",
      startTime: new Date(apt.startTime).toISOString().slice(0, 16),
      endTime: new Date(apt.endTime).toISOString().slice(0, 16),
      duration: apt.duration,
      location: apt.location ?? "",
      notes: apt.notes ?? "",
      status: apt.status,
    });
    setShowEdit(true);
  }

  function handleCreate() {
    if (!form.title || !form.startTime || !form.endTime || !form.userId) {
      toast.error("Preencha todos os campos obrigatórios."); return;
    }
    createMutation.mutate({ ...form, userId: Number(form.userId), duration: Number(form.duration) });
  }

  function handleUpdate() {
    if (!form.title || !form.startTime || !form.endTime) {
      toast.error("Preencha todos os campos obrigatórios."); return;
    }
    updateMutation.mutate({ id: selected.id, ...form, userId: Number(form.userId), duration: Number(form.duration), status: form.status as any });
  }

  // Calendário
  const calDays = getCalendarDays(calYear, calMonth);
  const monthName = new Date(calYear, calMonth).toLocaleString("pt-BR", { month: "long", year: "numeric" });

  function aptsForDay(day: number) {
    return (appointments as any[]).filter((apt: any) => {
      const d = new Date(apt.startTime);
      return d.getFullYear() === calYear && d.getMonth() === calMonth && d.getDate() === day;
    });
  }

  const aptsForSelected = selectedDay ? aptsForDay(selectedDay) : [];
  const stats = {
    total: (appointments as any[]).length,
    scheduled: (appointments as any[]).filter((a: any) => a.status === "scheduled").length,
    confirmed: (appointments as any[]).filter((a: any) => a.status === "confirmed").length,
    completed: (appointments as any[]).filter((a: any) => a.status === "completed").length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Calendário de Sessões</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie agendamentos e sessões com alunos</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={viewMode === "calendar" ? "default" : "outline"} size="sm" onClick={() => setViewMode("calendar")}>
              <Calendar className="h-4 w-4 mr-1" />Calendário
            </Button>
            <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")}>
              Lista
            </Button>
            <Button onClick={() => { setForm(emptyForm); setShowCreate(true); }}>
              <Plus className="h-4 w-4 mr-2" />Nova Sessão
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total", value: stats.total, icon: Calendar, color: "text-primary" },
            { label: "Agendadas", value: stats.scheduled, icon: Clock, color: "text-blue-600" },
            { label: "Confirmadas", value: stats.confirmed, icon: CheckCircle2, color: "text-green-600" },
            { label: "Concluídas", value: stats.completed, icon: CheckCircle2, color: "text-gray-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
                <p className="text-2xl font-bold mt-1">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {viewMode === "calendar" ? (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Calendário */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base capitalize">{monthName}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => {
                      if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                      else setCalMonth(m => m - 1);
                    }}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                      else setCalMonth(m => m + 1);
                    }}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calDays.map((day, idx) => {
                    if (!day) return <div key={`empty-${idx}`} />;
                    const dayApts = aptsForDay(day);
                    const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                    const isSelected = day === selectedDay;
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                        className={`relative p-2 rounded-lg text-sm transition-all min-h-[48px] text-left
                          ${isSelected ? "bg-primary text-primary-foreground" : isToday ? "bg-primary/10 text-primary font-bold" : "hover:bg-accent"}
                        `}
                      >
                        <span className="text-xs font-medium">{day}</span>
                        {dayApts.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-1">
                            {dayApts.slice(0, 3).map((apt: any) => (
                              <div key={apt.id} className={`w-1.5 h-1.5 rounded-full ${
                                apt.status === "confirmed" ? "bg-green-500" :
                                apt.status === "completed" ? "bg-gray-400" :
                                apt.status === "cancelled" ? "bg-red-400" : "bg-blue-500"
                              }`} />
                            ))}
                            {dayApts.length > 3 && <span className="text-[10px] opacity-70">+{dayApts.length - 3}</span>}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Painel do dia selecionado */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {selectedDay
                    ? `${selectedDay}/${calMonth + 1}/${calYear}`
                    : "Selecione um dia"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedDay ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Clique em um dia para ver as sessões.</p>
                ) : aptsForSelected.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-3">Nenhuma sessão neste dia.</p>
                    <Button size="sm" onClick={() => {
                      const d = new Date(calYear, calMonth, selectedDay, 9, 0);
                      const end = new Date(calYear, calMonth, selectedDay, 10, 0);
                      setForm({ ...emptyForm, startTime: d.toISOString().slice(0, 16), endTime: end.toISOString().slice(0, 16) });
                      setShowCreate(true);
                    }}><Plus className="h-4 w-4 mr-1" />Agendar</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {aptsForSelected.map((apt: any) => (
                      <div key={apt.id} className="p-3 rounded-lg border space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-tight">{apt.title}</p>
                          <StatusBadge status={apt.status} />
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTime(apt.startTime)} → {formatTime(apt.endTime)}
                        </div>
                        {apt.userName && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />{apt.userName}
                          </div>
                        )}
                        <div className="flex gap-1 pt-1">
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setSelected(apt); setShowDetail(true); }}>
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openEdit(apt)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-destructive" onClick={() => setConfirmDelete(apt.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" className="w-full" onClick={() => {
                      const d = new Date(calYear, calMonth, selectedDay, 9, 0);
                      const end = new Date(calYear, calMonth, selectedDay, 10, 0);
                      setForm({ ...emptyForm, startTime: d.toISOString().slice(0, 16), endTime: end.toISOString().slice(0, 16) });
                      setShowCreate(true);
                    }}><Plus className="h-4 w-4 mr-1" />Adicionar sessão</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Modo lista */
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base flex-1">Todas as Sessões</CardTitle>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (appointments as any[]).length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                  <p className="text-muted-foreground">Nenhuma sessão encontrada.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(appointments as any[]).map((apt: any) => (
                    <div key={apt.id} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-accent/20 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{apt.title}</p>
                          <StatusBadge status={apt.status} />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDateTime(apt.startTime)}</span>
                          {apt.userName && <span className="flex items-center gap-1"><User className="h-3 w-3" />{apt.userName}</span>}
                          {apt.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{apt.location}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => { setSelected(apt); setShowDetail(true); }}><Eye className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(apt)}><Edit className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(apt.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Dialog: Criar ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Sessão</DialogTitle>
            <DialogDescription>Agende uma sessão com um aluno.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="Ex: Sessão Individual" /></div>
            <div className="space-y-1.5"><Label>Tipo de Programa</Label>
              <Select value={form.programType} onValueChange={v => setForm(f => ({...f, programType: v}))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{PROGRAM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Início *</Label>
                <Input type="datetime-local" value={form.startTime} onChange={e => setForm(f => ({...f, startTime: e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Fim *</Label>
                <Input type="datetime-local" value={form.endTime} onChange={e => setForm(f => ({...f, endTime: e.target.value}))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Duração (min)</Label>
              <Input type="number" value={form.duration} onChange={e => setForm(f => ({...f, duration: Number(e.target.value)}))} /></div>
            <div className="space-y-1.5"><Label>Local</Label>
              <Input value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} placeholder="Online / Endereço" /></div>
            <div className="space-y-1.5"><Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2} className="resize-none" /></div>
            <div className="space-y-1.5"><Label>Notas internas</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={2} className="resize-none" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Editar ── */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Sessão</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Título</Label>
              <Input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} /></div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({...f, status: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUS_CONFIG).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>Tipo de Programa</Label>
              <Select value={form.programType} onValueChange={v => setForm(f => ({...f, programType: v}))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{PROGRAM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Início</Label>
                <Input type="datetime-local" value={form.startTime} onChange={e => setForm(f => ({...f, startTime: e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Fim</Label>
                <Input type="datetime-local" value={form.endTime} onChange={e => setForm(f => ({...f, endTime: e.target.value}))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Local</Label>
              <Input value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} /></div>
            <div className="space-y-1.5"><Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2} className="resize-none" /></div>
            <div className="space-y-1.5"><Label>Notas internas</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} rows={2} className="resize-none" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Detalhe ── */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{selected?.title}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <StatusBadge status={selected.status} />
              <div className="space-y-2 text-muted-foreground">
                <p className="flex items-center gap-2"><Clock className="h-4 w-4" />{formatDateTime(selected.startTime)} — {formatTime(selected.endTime)}</p>
                <p className="flex items-center gap-2"><Clock className="h-4 w-4" />{selected.duration} minutos</p>
                {selected.programType && <p className="flex items-center gap-2"><Calendar className="h-4 w-4" />{selected.programType}</p>}
                {selected.location && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{selected.location}</p>}
                {selected.userName && <p className="flex items-center gap-2"><User className="h-4 w-4" />{selected.userName}</p>}
              </div>
              {selected.description && <div className="border-t pt-3"><p className="font-medium mb-1">Descrição</p><p className="text-muted-foreground">{selected.description}</p></div>}
              {selected.notes && <div className="border-t pt-3"><p className="font-medium mb-1">Notas internas</p><p className="text-muted-foreground">{selected.notes}</p></div>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDetail(false); if (selected) openEdit(selected); }}>
              <Edit className="h-4 w-4 mr-2" />Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Confirmar delete ── */}
      <Dialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover sessão?</DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => confirmDelete && deleteMutation.mutate({ id: confirmDelete })}
              disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
