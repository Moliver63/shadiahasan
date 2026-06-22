import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { getLoginUrl } from "@/const";
import UserMenu from "@/components/UserMenu";
import InstallAppButton from "@/components/InstallAppButton";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Menu, Shield } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Link, useLocation } from "wouter";

export type PublicHeaderNavItem = {
  label: string;
  href: string;
  authOnly?: boolean;
  match?: "exact" | "prefix";
};

type PublicHeaderProps = {
  items: PublicHeaderNavItem[];
  sticky?: boolean;
  className?: string;
  logoAlt?: string;
};

function isItemActive(
  currentPath: string,
  href: string,
  match: PublicHeaderNavItem["match"] = "exact",
) {
  if (href === "/") {
    return currentPath === "/";
  }

  return match === "prefix"
    ? currentPath.startsWith(href)
    : currentPath === href;
}

export default function PublicHeader({
  items,
  sticky = true,
  className,
  logoAlt = "Shadia Hasan - Psicologia & Desenvolvimento Humano",
}: PublicHeaderProps) {
  const { isAuthenticated, user } = useAuth();
  const { theme } = useTheme();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const visibleItems = items.filter((item) => !item.authOnly || isAuthenticated);

  const handleLogin = () => {
    window.location.href = getLoginUrl();
  };

  const renderNavButton = (item: PublicHeaderNavItem, mobile = false) => {
    const active = isItemActive(location, item.href, item.match);

    return (
      <Button
        key={`${item.href}-${mobile ? "mobile" : "desktop"}`}
        asChild
        variant={active ? "secondary" : "ghost"}
        size={mobile ? "lg" : "default"}
        className={cn(mobile && "w-full justify-start")}
      >
        <Link href={item.href} onClick={() => setOpen(false)}>
          {item.label}
        </Link>
      </Button>
    );
  };

  return (
    <header
      className={cn(
        "border-b bg-card/95 backdrop-blur",
        sticky && "sticky top-0 z-50",
        className,
      )}
    >
      <div className="container flex items-center justify-between gap-3 py-3 sm:py-4">
        <Link href="/" onClick={() => setOpen(false)}>
          <img
            src={theme === "dark" ? "/logo-white.png" : "/logo.png"}
            alt={logoAlt}
            className="h-14 w-auto sm:h-16 md:h-20 lg:h-24 xl:h-28 transition-opacity duration-200"
          />
        </Link>

        <nav className="hidden items-center gap-2 lg:flex xl:gap-3">
          {visibleItems.map((item) => renderNavButton(item))}
          <ThemeToggle />
          <InstallAppButton />

          {isAuthenticated ? (
            <>
              {user?.role === "admin" && (
                <Button asChild variant="outline">
                  <Link href="/admin"> 
                    <Shield className="mr-2 h-4 w-4" />
                    Admin
                  </Link>
                </Button>
              )}
              <UserMenu />
            </>
          ) : (
            <Button onClick={handleLogin}>Entrar</Button>
          )}
        </nav>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          {isAuthenticated && user?.role === "admin" && (
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/admin">
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            </Button>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-sm">
              <SheetHeader className="px-0 pb-2">
                <SheetTitle>Navegação</SheetTitle>
                <SheetDescription>
                  Acesse as principais áreas da plataforma.
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-2 px-1 pb-6">
                {visibleItems.map((item) => renderNavButton(item, true))}
                <InstallAppButton mobile />

                {isAuthenticated && user?.role === "admin" && (
                  <Button asChild variant="outline" size="lg" className="justify-start">
                    <Link href="/admin" onClick={() => setOpen(false)}>
                      <Shield className="mr-2 h-4 w-4" />
                      Admin
                    </Link>
                  </Button>
                )}

                {isAuthenticated ? (
                  <div className="pt-2">
                    <UserMenu />
                  </div>
                ) : (
                  <Button size="lg" onClick={handleLogin}>
                    Entrar
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
