import { useUniverseStore } from '../../store/useUniverseStore';
import { getVisualProfile } from '../../utils/visualPhase';

export function CinematicHud() {
  const { progress, activeMode } = useUniverseStore();
  const profile = getVisualProfile(progress);

  if (activeMode === 'centerless') {
    return (
      <div className="scene-caption absolute left-6 top-6 z-10 max-w-sm px-3 py-2">
        <div className="text-[10px] uppercase tracking-[0.24em] text-blue-300">Comparacao de observadores</div>
        <div className="mt-1 text-xs text-slate-200">Clique em outra galaxia para recentralizar.</div>
      </div>
    );
  }

  return (
    <>
      <div className="scene-caption absolute left-6 top-6 z-10 max-w-md px-3 py-2 text-slate-200">
        <div className="flex items-center gap-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-blue-300">{profile.scaleLabel}</div>
          <div className="font-mono text-[10px] text-slate-400">{Math.round(progress)}%</div>
        </div>
        <div className="mt-1 text-lg font-semibold text-white">{profile.title}</div>
        <p className="mt-1 text-xs leading-5 text-slate-300">{profile.caption}</p>
      </div>
      <div className="scene-caption absolute right-6 top-6 z-10 hidden w-56 px-3 py-2 text-xs text-slate-300 md:block">
        <div className="mb-2 border-b border-blue-200/10 pb-2 text-[10px] uppercase tracking-[0.22em] text-blue-300">Status cosmico</div>
        <div className="flex justify-between gap-4 py-1"><span>Luz</span><span className="font-mono text-slate-100">{Math.round(profile.light * 100)}%</span></div>
        <div className="flex justify-between gap-4 py-1"><span>Gas</span><span className="font-mono text-slate-100">{Math.round(profile.gas * 100)}%</span></div>
        <div className="flex justify-between gap-4 py-1"><span>Estrelas</span><span className="font-mono text-slate-100">{Math.round(profile.stars * 100)}%</span></div>
      </div>
    </>
  );
}

export function CenterlessMarker() {
  const { activeMode } = useUniverseStore();
  if (activeMode !== 'centerless') return null;

  return (
    <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none whitespace-nowrap font-mono text-[10px] tracking-widest text-green-400 mt-8">
      [ VOCE E O OBSERVADOR ]
    </div>
  );
}
