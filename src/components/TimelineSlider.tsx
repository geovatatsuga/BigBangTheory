import { useUniverseStore } from '../store/useUniverseStore';

export default function TimelineSlider() {
  const { progress, setProgress, isPlaying } = useUniverseStore();

  return (
    <div className="relative flex h-10 w-full items-center">
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
