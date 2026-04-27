import { useUniverseStore } from '../store/useUniverseStore';
import { cosmicTimelineMilestones, formatCosmicAge, getCurrentMilestone } from '../utils/cosmicTime';

export default function TimelineSlider() {
  const { progress, setProgress, isPlaying } = useUniverseStore();
  const cosmicAge = formatCosmicAge(progress);
  const currentMilestone = getCurrentMilestone(progress);
  const visibleMilestones = cosmicTimelineMilestones.filter((milestone) => milestone.progress < 100);

  return (
    <div className="relative flex h-20 w-full items-center pt-4">
      <div className="absolute top-0 left-0 right-0 flex items-center justify-center">
        <div className="max-w-full truncate rounded border border-blue-200/15 bg-slate-950/75 px-3 py-1 text-center shadow-[0_0_18px_rgba(59,130,246,0.18)]">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-blue-100">{cosmicAge}</span>
          <span className="mx-2 text-blue-300/50">/</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-100">{currentMilestone.stateLabel}</span>
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

      <div className="absolute left-0 right-0 top-12 hidden h-7 md:block">
        {visibleMilestones.map((milestone) => (
          <div
            key={milestone.stateLabel}
            className={`absolute top-0 flex flex-col gap-1 ${
              milestone.progress === 0 ? 'translate-x-0 items-start' : '-translate-x-1/2 items-center'
            }`}
            style={{ left: `${milestone.progress}%` }}
          >
            <div className="h-3 w-px bg-cyan-200/70" />
            <div className="whitespace-nowrap font-mono text-[8px] uppercase tracking-[0.12em] text-blue-100/80">
              {milestone.timeLabel}
            </div>
          </div>
        ))}
        <div className="absolute right-0 top-0 flex flex-col items-end gap-1">
          <div className="h-3 w-px bg-cyan-200/70" />
          <div className="whitespace-nowrap font-mono text-[8px] uppercase tracking-[0.12em] text-blue-100/80">
            13,8 bi anos
          </div>
        </div>
      </div>

      <div className="absolute left-0 right-0 top-14 flex justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-blue-200/80 md:hidden">
        <span>0 s</span>
        <span>13,8 bi anos</span>
      </div>
    </div>
  );
}
