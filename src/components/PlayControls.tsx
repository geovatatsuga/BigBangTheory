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
    <div className="flex items-center gap-3">
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center hover:scale-105 transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] cursor-pointer"
        title={isPlaying ? 'Pausar' : 'Reproduzir'}
      >
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
      </button>
      <button
        onClick={() => {
          setIsPlaying(false);
          setProgress(0);
        }}
        className="h-10 w-10 rounded-full border border-slate-800 bg-slate-900/60 hover:bg-slate-900/90 text-slate-400 hover:text-white flex items-center justify-center hover:scale-105 transition-all cursor-pointer"
        title="Voltar ao início"
      >
        <RotateCcw size={14} />
      </button>
    </div>
  );
}
