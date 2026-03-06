import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Button } from "./ui/button";
import { Maximize2, X } from "lucide-react";

interface VRViewerProps {
  videoUrl: string;
  title?: string;
  onClose?: () => void;
}

// Detecta se a URL é do YouTube
function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function VideoSphere({ videoUrl }: { videoUrl: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.src = videoUrl;
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = false;
    video.playsInline = true;

    // Load HLS if needed
    if (videoUrl.includes(".m3u8")) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = videoUrl;
      } else {
        import("hls.js").then((module) => {
          const Hls = module.default;
          if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(videoUrl);
            hls.attachMedia(video);
          }
        });
      }
    }

    video.play().catch((err) => {
      console.warn("Autoplay prevented:", err);
    });

    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBAFormat;

    setTexture(videoTexture);
    videoRef.current = video;

    return () => {
      video.pause();
      video.src = "";
      videoTexture.dispose();
    };
  }, [videoUrl]);

  if (!texture) {
    return null;
  }

  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 60, 40]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  );
}

export default function VRViewer({ videoUrl, title, onClose }: VRViewerProps) {
  const [isVRMode, setIsVRMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const youtubeId = getYouTubeId(videoUrl);

  const enterVR = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if ("xr" in navigator) {
        const xr = (navigator as any).xr;
        const isSupported = await xr.isSessionSupported("immersive-vr");

        if (isSupported) {
          const session = await xr.requestSession("immersive-vr");
          setIsVRMode(true);
          console.log("VR session started", session);
        } else {
          alert(
            "WebXR não suportado neste dispositivo. Use Meta Quest Browser para melhor experiência."
          );
        }
      } else {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
          setIsFullscreen(true);
        }
      }
    } catch (error) {
      console.error("Erro ao entrar em modo VR:", error);
      if (container.requestFullscreen) {
        await container.requestFullscreen();
        setIsFullscreen(true);
      }
    }
  };

  const exitFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // ✅ Se for YouTube, exibe iframe em vez do VR sphere
  if (youtubeId) {
    return (
      <div ref={containerRef} className="relative w-full rounded-lg overflow-hidden bg-black" style={{ paddingTop: "56.25%" }}>
        <iframe
          className="absolute top-0 left-0 w-full h-full"
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=0&rel=0`}
          title={title || "YouTube Video"}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        {onClose && (
          <div className="absolute top-4 right-4">
            <Button
              size="sm"
              variant="secondary"
              onClick={onClose}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ✅ Renderiza VR normal para HLS/MP4
  return (
    <div
      ref={containerRef}
      className="relative w-full h-[600px] bg-black rounded-lg overflow-hidden"
    >
      <Canvas
        camera={{ position: [0, 0, 0.1], fov: 75 }}
        gl={{ antialias: true }}
      >
        <VideoSphere videoUrl={videoUrl} />
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          rotateSpeed={-0.5}
          minDistance={0.1}
          maxDistance={1}
        />
      </Canvas>

      {/* Controls overlay */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <div className="text-white">
            <h3 className="font-semibold">{title || "Visualização VR"}</h3>
            <p className="text-xs text-white/70 mt-1">
              Arraste para olhar ao redor • Scroll para zoom
            </p>
          </div>
          <div className="flex gap-2">
            {!isFullscreen && (
              <Button
                size="sm"
                variant="secondary"
                onClick={enterVR}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <Maximize2 className="h-4 w-4 mr-2" />
                Modo VR
              </Button>
            )}
            {isFullscreen && (
              <Button
                size="sm"
                variant="secondary"
                onClick={exitFullscreen}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <X className="h-4 w-4 mr-2" />
                Sair Fullscreen
              </Button>
            )}
            {onClose && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onClose}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* VR Instructions */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="text-white text-sm space-y-2">
          <p className="font-semibold">💡 Dicas para melhor experiência:</p>
          <ul className="text-xs text-white/80 space-y-1 ml-4 list-disc">
            <li>
              Use <strong>Meta Quest Browser</strong> para experiência VR
              completa
            </li>
            <li>Clique em "Modo VR" para entrar em tela cheia imersiva</li>
            <li>Use os controles do Quest para navegar no ambiente 360°</li>
            <li>
              Em dispositivos sem VR, use o mouse para explorar o vídeo 360°
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
