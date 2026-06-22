import { Link } from "wouter";
import { Play, Lock, BookOpen } from "lucide-react";

interface CourseCardProps {
  id: number;
  title: string;
  description?: string | null;
  thumbnail?: string | null;
  slug: string;
  /** Progresso do aluno (0-100), só exibido em MyCourses */
  progress?: number;
  /** Se o curso requer assinatura */
  isRestricted?: boolean;
  /** Número de aulas */
  lessonCount?: number;
}

export default function CourseCard({
  title,
  description,
  thumbnail,
  slug,
  progress,
  isRestricted,
  lessonCount,
}: CourseCardProps) {
  return (
    <Link href={`/courses/${slug}`}>
      <div className="course-card group relative cursor-pointer select-none">
        {/* ── Imagem / Thumbnail ── */}
        <div className="course-card__media">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={title}
              className="course-card__img"
              loading="lazy"
            />
          ) : (
            <div className="course-card__placeholder">
              <BookOpen className="h-12 w-12 text-white/40" />
            </div>
          )}

          {/* Gradiente inferior (sempre visível, mais intenso no hover) */}
          <div className="course-card__gradient" />

          {/* Overlay escuro no hover */}
          <div className="course-card__overlay" />

          {/* Botão play central — aparece no hover */}
          <div className="course-card__play">
            <div className="course-card__play-btn">
              <Play className="h-6 w-6 text-white fill-white ml-0.5" />
            </div>
          </div>

          {/* Badge de bloqueio */}
          {isRestricted && (
            <div className="course-card__badge">
              <Lock className="h-3 w-3" />
              <span>Premium</span>
            </div>
          )}

          {/* Título e descrição sobre a imagem (visíveis no hover) */}
          <div className="course-card__info">
            <h3 className="course-card__title">{title}</h3>
            {description && (
              <p className="course-card__desc">{description}</p>
            )}
            {lessonCount !== undefined && (
              <span className="course-card__meta">
                {lessonCount} {lessonCount === 1 ? "aula" : "aulas"}
              </span>
            )}
          </div>
        </div>

        {/* Barra de progresso (só em MyCourses) */}
        {progress !== undefined && (
          <div className="course-card__progress-wrap">
            <div className="course-card__progress-track">
              <div
                className="course-card__progress-fill"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <span className="course-card__progress-label">{progress}%</span>
          </div>
        )}
      </div>
    </Link>
  );
}
