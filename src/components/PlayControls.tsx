import { useEffect } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useUniverseStore } from '../store/useUniverseStore';

function getPlaybackSpeed(progress: number) {
  if (progress < 4) return 0.65;
  if (progress < 12) return 1.75;
  if (progress < 65) return 1.12;
  if (progress < 75) return 0.92;
  if (progress < 84) return 0.72;
  if (progress < 98) return 0.34;
  return 0.52;
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
        const step = (dt / 1000) * (100 / 58) * getPlaybackSpeed(state.progress);
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
