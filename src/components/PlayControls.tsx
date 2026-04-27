import { useEffect } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useUniverseStore } from '../store/useUniverseStore';

export default function PlayControls() {
  const { progress, setProgress, isPlaying, setIsPlaying } = useUniverseStore();

  useEffect(() => {
    let animationId = 0;
    let lastTime = 0;

    const animate = (time: number) => {
      if (lastTime > 0 && isPlaying) {
        const dt = time - lastTime;
        const step = (dt / 1000) * (100 / 38);
        const nextProgress = Math.min(100, progress + step);
        setProgress(nextProgress);
        if (nextProgress >= 100) setIsPlaying(false);
      }

      lastTime = time;
      if (isPlaying) animationId = requestAnimationFrame(animate);
    };

    if (isPlaying) animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, progress, setProgress, setIsPlaying]);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        className="control-primary"
        title={isPlaying ? 'Pausar' : 'Reproduzir'}
      >
        {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
      </button>
      <button
        onClick={() => {
          setIsPlaying(false);
          setProgress(0);
        }}
        className="control-secondary"
        title="Voltar ao inicio"
      >
        <RotateCcw size={15} />
      </button>
    </div>
  );
}
