import { useTheme } from "@/contexts/ThemeContext";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface SiteLogoProps {
  className?: string;
  href?: string;
  onClick?: () => void;
}

export default function SiteLogo({ className, href, onClick }: SiteLogoProps) {
  const { theme } = useTheme();
  const src = theme === "dark" ? "/logo-white.png" : "/logo.png";

  const img = (
    <img
      src={src}
      alt="Shadia Hasan - Psicologia & Desenvolvimento Humano"
      className={cn("transition-opacity duration-200", className)}
    />
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick}>
        {img}
      </Link>
    );
  }

  return img;
}
