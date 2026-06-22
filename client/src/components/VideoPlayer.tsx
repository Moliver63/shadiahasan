import { useEffect, useRef, useState } from "react";
import {
  Languages,
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Slider } from "./ui/slider";

interface VideoPlayerProps {
  src: string;
  title?: string;
  preferredLanguage?: string; // ex: "pt-BR", "en" — vem de userSettings.language
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
}

type AudioTrackOption = {
  id: number;
  label: string;
  language: string;
};

// Detecta se a URL é do YouTube e retorna o ID do vídeo
function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export default function VideoPlayer({
  src,
  title,
  preferredLanguage,
  onProgress,
  onComplete,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<any>(null);
  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [audioTracks, setAudioTracks] = useState<AudioTrackOption[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState("0");

  const youtubeId = getYouTubeId(src);

  useEffect(() => {
    if (youtubeId) return;

    const handleFullscreenChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      setIsFullscreen(Boolean(document.fullscreenElement || doc.webkitFullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener(
      "webkitfullscreenchange",
      handleFullscreenChange as EventListener
    );

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange as EventListener
      );
    };
  }, [youtubeId]);

  useEffect(() => {
    if (youtubeId) return;

    const video = videoRef.current;
    if (!video) return;

    hlsRef.current?.destroy?.();
    hlsRef.current = null;
    setAudioTracks([]);
    setSelectedAudioTrack("0");
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setShowControls(true);

    const syncNativeAudioTracks = () => {
      const nativeTracks = Array.from(
        ((video as HTMLVideoElement & { audioTracks?: ArrayLike<any> }).audioTracks || []) as ArrayLike<any>
      ).map((track: any, index) => ({
        id: index,
        label: track.label || track.language || `Áudio ${index + 1}`,
        language: track.language || "",
      }));

      if (nativeTracks.length > 1) {
        setAudioTracks(nativeTracks);
        const enabledIndex = nativeTracks.findIndex((_, index) =>
          Boolean(
            (video as HTMLVideoElement & { audioTracks?: ArrayLike<any> }).audioTracks?.[index]?.enabled
          )
        );
        setSelectedAudioTrack(String(enabledIndex >= 0 ? enabledIndex : 0));
      }
    };

    if (src.includes(".m3u8")) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
      } else {
        void import("hls.js").then((module) => {
          const Hls = module.default;
          if (!Hls.isSupported()) return;

          const hls = new Hls();
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(video);

          const extractTracks = (tracksSource: any[]) =>
            (tracksSource || []).map((track: any, index: number) => ({
              id: index,
              label: track.name || track.label || track.lang || `Áudio ${index + 1}`,
              language: track.lang || track.language || "",
            }));

          // Tenta selecionar automaticamente a faixa que combina com o idioma preferido
          const autoSelectByLanguage = (tracks: AudioTrackOption[]): number => {
            if (!preferredLanguage || tracks.length <= 1) return 0;
            const lang = preferredLanguage.toLowerCase();
            // Tenta match exato (ex: "pt-BR"), depois prefixo (ex: "pt"), depois padrão 0
            const exact = tracks.findIndex((t) => t.language.toLowerCase() === lang);
            if (exact >= 0) return exact;
            const prefix = tracks.findIndex((t) => t.language.toLowerCase().startsWith(lang.split("-")[0]));
            return prefix >= 0 ? prefix : 0;
          };

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            const tracks = extractTracks(hls.audioTracks || []);
            setAudioTracks(tracks.length > 1 ? tracks : []);
            if (tracks.length > 1) {
              const preferred = autoSelectByLanguage(tracks);
              hls.audioTrack = preferred;
              setSelectedAudioTrack(String(preferred));
            }
          });

          hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event: unknown, data: any) => {
            const tracks = extractTracks(data.audioTracks || []);
            setAudioTracks(tracks.length > 1 ? tracks : []);
            if (tracks.length > 1) {
              const preferred = autoSelectByLanguage(tracks);
              hls.audioTrack = preferred;
              setSelectedAudioTrack(String(preferred));
            }
          });

          hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_event: unknown, data: any) => {
            setSelectedAudioTrack(String(data.id ?? 0));
          });
        });
      }
    } else {
      video.src = src;
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (onProgress && video.duration > 0) {
        const progress = (video.currentTime / video.duration) * 100;
        onProgress(progress);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
      syncNativeAudioTracks();
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleEnded = () => {
      setIsPlaying(false);
      if (onComplete) {
        onComplete();
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      hlsRef.current?.destroy?.();
      hlsRef.current = null;
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, [src, onProgress, onComplete, youtubeId]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      void video.play();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    const newVolume = value[0] || 0;
    video.volume = newVolume / 100;
    video.muted = newVolume === 0;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const newTime = ((value[0] || 0) / 100) * duration;
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container) return;

    const containerWithWebkit = container as HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const videoWithWebkit = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
    };
    const documentWithWebkit = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
    };

    if (!isFullscreen) {
      if (container.requestFullscreen) {
        await container.requestFullscreen();
      } else if (containerWithWebkit.webkitRequestFullscreen) {
        await containerWithWebkit.webkitRequestFullscreen();
      } else if (videoWithWebkit?.webkitEnterFullscreen) {
        videoWithWebkit.webkitEnterFullscreen();
      }
      return;
    }

    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if (documentWithWebkit.webkitExitFullscreen) {
      await documentWithWebkit.webkitExitFullscreen();
    }
  };

  const handleAudioTrackChange = (value: string) => {
    const trackIndex = Number(value);
    setSelectedAudioTrack(value);

    if (Number.isNaN(trackIndex)) return;

    if (hlsRef.current) {
      hlsRef.current.audioTrack = trackIndex;
      return;
    }

    const video = videoRef.current as HTMLVideoElement & { audioTracks?: ArrayLike<any> };
    const nativeTracks = video?.audioTracks;
    if (!nativeTracks) return;

    Array.from(nativeTracks as ArrayLike<any>).forEach((track: any, index) => {
      track.enabled = index === trackIndex;
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    hideControlsTimeout.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  // ✅ Renderiza iframe do YouTube
  if (youtubeId) {
    return (
      <div
        ref={containerRef}
        className="relative w-full rounded-lg overflow-hidden bg-black"
        style={{ paddingTop: "56.25%" }}
      >
        <iframe
          className="absolute top-0 left-0 w-full h-full"
          src={`https://www.youtube.com/embed/${youtubeId}?rel=0`}
          title={title || "YouTube Video"}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  // ✅ Renderiza player nativo para HLS/MP4
  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-lg bg-black group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="aspect-video w-full"
        onClick={togglePlay}
        onDoubleClick={() => void toggleFullscreen()}
        playsInline
      />

      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        {title && (
          <div className="absolute left-0 right-0 top-0 p-4">
            <h3 className="font-semibold text-white">{title}</h3>
          </div>
        )}

        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              size="lg"
              variant="secondary"
              className="h-16 w-16 rounded-full"
              onClick={togglePlay}
            >
              <Play className="h-8 w-8" />
            </Button>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 space-y-2 p-4">
          {audioTracks.length > 1 && (
            <div className="flex justify-end">
              <div className="flex items-center gap-2 rounded-md bg-black/45 px-2 py-1.5 backdrop-blur-sm">
                <Languages className="h-4 w-4 text-white" />
                <Select value={selectedAudioTrack} onValueChange={handleAudioTrackChange}>
                  <SelectTrigger className="h-8 min-w-[160px] border-white/20 bg-transparent px-2 text-xs text-white focus:ring-white/30">
                    <SelectValue placeholder="Áudio" />
                  </SelectTrigger>
                  <SelectContent>
                    {audioTracks.map((track) => (
                      <SelectItem key={track.id} value={String(track.id)}>
                        {track.label}
                        {track.language ? ` (${track.language})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Slider
            value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
            onValueChange={handleSeek}
            max={100}
            step={0.1}
            className="cursor-pointer"
          />

          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/20"
                onClick={togglePlay}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>
                <Slider
                  value={[volume]}
                  onValueChange={handleVolumeChange}
                  max={100}
                  className="w-20"
                />
              </div>

              <span className="ml-2 text-sm text-white">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/20"
              onClick={() => void toggleFullscreen()}
              aria-label={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
              title={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
            >
              {isFullscreen ? (
                <Minimize className="h-5 w-5" />
              ) : (
                <Maximize className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
