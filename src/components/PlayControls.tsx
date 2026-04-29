import { useEffect } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useUniverseStore } from '../store/useUniverseStore';

function getPlaybackSpeed(progress: number) {
  if (progress < 4) return 0.5;
  if (progress < 12) return 1.5;
  if (progress < 22) return 0.8;
  if (progress < 58) return 0.46;
  if (progress < 70) return 0.62;
  if (progress < 90) return 0.72;
  return 0.6;
}

export default function PlayControls() {
  const { setProgress, isPlaying, setIsPlaying } = useUniverseStore();

  useEffect(() => {
    let animationId = 0;
    let lastTime = 0;

    const animate = (time: number) => {
      const state = useUniverseStore.getState();
      if (lastTime > 0 && state.isPlaying) {
        const dt = time - lastTime;
        const step = (dt / 1000) * (100 / 30) * getPlaybackSpeed(state.progress);
        const nextProgress = Math.min(100, state.progress + step);
        state.setProgress(nextProgress);
        if (nextProgress >= 100) state.setIsPlaying(false);
      }

      lastTime = time;
      if (useUniverseStore.getState().isPlaying) animationId = requestAnimationFrame(animate);
    };

    if (isPlaying) animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying]);

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
