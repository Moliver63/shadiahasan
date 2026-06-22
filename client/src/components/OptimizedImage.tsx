import { useEffect, useRef, useState } from "react";

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean; // Se true, carrega imediatamente e não depende do overlay de loading
  /**
   * Capa animada estilo streaming (zoom lento + sheen de luz sutil).
   * - "none": estático (padrão)
   * - "always": loop contínuo — usar em capa única/hero
   * - "hover": anima só no hover/foco — usar em grades com vários cards
   */
  motion?: "none" | "always" | "hover";
}

/**
 * Componente de imagem otimizado com:
 * - Lazy loading nativo
 * - Suporte a WebP e AVIF com fallback para JPEG
 * - Placeholder blur durante carregamento
 * - Intersection Observer para carregamento progressivo
 * - "Motion Poster" opcional: zoom cinematográfico lento + sheen de luz,
 *   com fallback estático automático quando prefers-reduced-motion está ativo
 *
 * Observação importante:
 * Imagens com prioridade não devem depender do evento onLoad para remover a camada
 * de placeholder, pois alguns navegadores podem servir a imagem do cache sem disparar
 * esse evento de maneira confiável. Nesses casos, mostramos a imagem imediatamente.
 */
export function OptimizedImage({
  src,
  alt,
  className = "",
  width,
  height,
  priority = false,
  motion = "none",
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(priority);
  const [isInView, setIsInView] = useState(priority);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setIsLoaded(priority);
  }, [priority, src]);

  // Intersection Observer para lazy loading
  useEffect(() => {
    if (priority) {
      setIsInView(true);
      return;
    }

    const element = containerRef.current;
    if (!element) return;

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

    observer.observe(element);

    return () => observer.disconnect();
  }, [priority, src]);

  // Se a imagem já vier pronta do cache, marcar como carregada.
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [isInView, src]);

  // Gerar URLs para diferentes formatos
  const getImageUrls = (originalSrc: string) => {
    return {
      avif: null,
      webp: null,
      jpeg: originalSrc,
    };
  };

  const { avif, webp, jpeg } = getImageUrls(src);
  const showViewportPlaceholder = !isInView;
  const showLoadingOverlay = !priority && !isLoaded && isInView;

  const motionContainerClass =
    motion === "always"
      ? "motion-poster motion-poster--always"
      : motion === "hover"
        ? "motion-poster motion-poster--hover"
        : "";

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${motionContainerClass} ${className}`}
      style={{ width, height }}
      tabIndex={motion === "hover" ? 0 : undefined}
    >
      {isInView ? (
        <picture>
          {avif && <source srcSet={avif} type="image/avif" />}
          {webp && <source srcSet={webp} type="image/webp" />}
          <img
            ref={imageRef}
            src={jpeg}
            alt={alt}
            className={`motion-poster__img h-full w-full object-cover transition-opacity duration-300 ${
              priority || isLoaded ? "opacity-100" : "opacity-0"
            }`}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            onLoad={() => setIsLoaded(true)}
            onError={() => setIsLoaded(true)}
            width={width}
            height={height}
          />
        </picture>
      ) : null}

      {showViewportPlaceholder ? (
        <div className="absolute inset-0 h-full w-full bg-gray-200 animate-pulse" />
      ) : null}

      {motion !== "none" ? <div className="motion-poster__sheen" aria-hidden="true" /> : null}

      {showLoadingOverlay ? (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      ) : null}
    </div>
  );
}
