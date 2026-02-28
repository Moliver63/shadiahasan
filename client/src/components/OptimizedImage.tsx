import { useState, useEffect, useRef } from "react";

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean; // Se true, não usa lazy loading
}

/**
 * Componente de imagem otimizado com:
 * - Lazy loading nativo
 * - Suporte a WebP e AVIF com fallback para JPEG
 * - Placeholder blur durante carregamento
 * - Intersection Observer para carregamento progressivo
 */
export function OptimizedImage({
  src,
  alt,
  className = "",
  width,
  height,
  priority = false,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer para lazy loading
  useEffect(() => {
    if (priority || !imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "50px", // Começa a carregar 50px antes de entrar na viewport
      }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, [priority]);

  // Gerar URLs para diferentes formatos
  const getImageUrls = (originalSrc: string) => {
    // Se a imagem já está em CDN, gerar variantes
    if (originalSrc.includes("manuscdn.com")) {
      const baseUrl = originalSrc.replace(/\.(jpg|jpeg|png)$/i, "");
      return {
        avif: `${baseUrl}.avif`,
        webp: `${baseUrl}.webp`,
        jpeg: originalSrc,
      };
    }
    
    // Para imagens locais, retornar apenas o original
    return {
      avif: null,
      webp: null,
      jpeg: originalSrc,
    };
  };

  const { avif, webp, jpeg } = getImageUrls(src);

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={{ width, height }}
    >
      {isInView ? (
        <picture>
          {/* AVIF - menor tamanho, melhor qualidade */}
          {avif && <source srcSet={avif} type="image/avif" />}
          
          {/* WebP - bom suporte, boa compressão */}
          {webp && <source srcSet={webp} type="image/webp" />}
          
          {/* JPEG - fallback universal */}
          <img
            src={jpeg}
            alt={alt}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`}
            loading={priority ? "eager" : "lazy"}
            onLoad={() => setIsLoaded(true)}
            width={width}
            height={height}
          />
        </picture>
      ) : (
        // Placeholder enquanto não está na viewport
        <div className="w-full h-full bg-gray-200 animate-pulse" />
      )}
      
      {/* Blur placeholder durante carregamento */}
      {!isLoaded && isInView && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
    </div>
  );
}
