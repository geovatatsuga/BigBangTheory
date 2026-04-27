import { useUniverseStore } from '../store/useUniverseStore';
import { formatCosmicAge } from '../utils/cosmicTime';

export default function TimelineSlider() {
  const { progress, setProgress, isPlaying } = useUniverseStore();
  const cosmicAge = formatCosmicAge(progress);

  return (
    <div className="relative flex h-10 w-full items-center">
      <div className="absolute -top-4 left-0 right-0 flex items-center justify-center">
        <div className="rounded border border-blue-200/15 bg-slate-950/70 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-blue-100 shadow-[0_0_18px_rgba(59,130,246,0.18)]">
          {cosmicAge}
        </div>
      </div>
      <div className="absolute h-1.5 w-full rounded-full bg-slate-950/90 shadow-inner" />
      <div
        className="absolute h-1.5 rounded-full bg-gradient-to-r from-blue-500 via-cyan-300 to-amber-200 shadow-[0_0_22px_rgba(96,165,250,0.45)] transition-all duration-100"
        style={{ width: `${progress}%` }}
      />
      <div
        className="absolute -ml-2 h-4 w-4 rounded-full border border-white bg-blue-200 shadow-[0_0_20px_rgba(147,197,253,0.82)] transition-all duration-100"
        style={{ left: `${progress}%` }}
      />

      <input
        type="range"
        min="0"
        max="100"
        step="0.1"
        value={progress}
        onChange={(event) => setProgress(parseFloat(event.target.value))}
        disabled={isPlaying}
        className="absolute inset-0 z-10 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />

      <div className="absolute top-7 left-0 right-0 flex justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-blue-200/80">
        <span>Big Bang</span>
        <span>Hoje</span>
      </div>
    </div>
  );
}
