import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  User,
  Settings,
  CreditCard,
  Award,
  LogOut,
  ChevronDown,
  BookOpen,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function UserMenu() {
  const { user, loading } = useAuth();
  const logoutMutation = trpc.auth.logout.useMutation();

  const { data: unreadCount } = trpc.messaging.getUnreadCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30000,
  });

  if (loading || !user) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      toast.success("Logout realizado com sucesso!");
      window.location.href = "/";
    } catch (error) {
      toast.error("Erro ao fazer logout");
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const isAdmin = user.role === "admin" || user.role === "superadmin";
  const isSuperAdmin = user.role === "superadmin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 h-auto py-2 px-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={undefined} alt={user.name || "Usuario"} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start">
            <span className="text-sm font-medium">{user.name || "Usuario"}</span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{user.name || "Usuario"}</p>
              {isSuperAdmin && (
                <Badge variant="destructive" className="text-xs px-1 py-0">Super Admin</Badge>
              )}
              {user.role === "admin" && (
                <Badge variant="secondary" className="text-xs px-1 py-0">Admin</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <Link href="/profile">
            <DropdownMenuItem className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>Ver Perfil</span>
            </DropdownMenuItem>
          </Link>
          <Link href="/my-courses">
            <DropdownMenuItem className="cursor-pointer">
              <BookOpen className="mr-2 h-4 w-4" />
              <span>Meus Programas</span>
            </DropdownMenuItem>
          </Link>
          <Link href="/certificates">
            <DropdownMenuItem className="cursor-pointer">
              <Award className="mr-2 h-4 w-4" />
              <span>Meus Certificados</span>
            </DropdownMenuItem>
          </Link>
          <Link href="/messages">
            <DropdownMenuItem className="cursor-pointer">
              <MessageCircle className="mr-2 h-4 w-4" />
              <span>Mensagens</span>
              {unreadCount && unreadCount > 0 && (
                <Badge className="ml-auto" variant="destructive">{unreadCount}</Badge>
              )}
            </DropdownMenuItem>
          </Link>
          <Link href="/my-subscription">
            <DropdownMenuItem className="cursor-pointer">
              <CreditCard className="mr-2 h-4 w-4" />
              <span>Minha Assinatura</span>
            </DropdownMenuItem>
          </Link>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <Link href="/edit-profile">
            <DropdownMenuItem className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>Editar Perfil</span>
            </DropdownMenuItem>
          </Link>
          <DropdownMenuItem className="cursor-pointer" disabled>
            <Settings className="mr-2 h-4 w-4" />
            <span>Configuracoes</span>
            <span className="ml-auto text-xs text-muted-foreground">Em breve</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <Link href="/admin">
                <DropdownMenuItem className="cursor-pointer text-primary focus:text-primary">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  <span>Painel Admin</span>
                </DropdownMenuItem>
              </Link>
            </DropdownMenuGroup>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
