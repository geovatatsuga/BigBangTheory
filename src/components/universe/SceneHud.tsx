import { useUniverseStore } from '../../store/useUniverseStore';
import { getVisualProfile } from '../../utils/visualPhase';
import { Timer, Sparkles, Milestone } from 'lucide-react';

export function CinematicHud() {
  const { progress, activeMode } = useUniverseStore();
  const profile = getVisualProfile(progress);

  if (activeMode === 'centerless') {
    return (
      <div className="absolute left-6 top-22 z-10 max-w-sm rounded-2xl border border-slate-800/80 bg-[#030712]/65 backdrop-blur-md px-5 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.4)] text-slate-200 border-l-2 border-l-green-500 animate-fade-in">
        <div className="flex items-center gap-2">
          <Milestone size={12} className="text-green-400" />
          <div className="text-[9px] uppercase tracking-[0.22em] text-green-400 font-bold">Modo Expansão</div>
        </div>
        <div className="mt-2 text-base font-extrabold text-white tracking-tight">Expansão sem Centro</div>
        <p className="mt-2 text-xs leading-relaxed text-slate-400 font-light">
          Clique em qualquer galáxia para mudar o referencial. Note como todas as galáxias parecem se afastar dele uniformemente, demonstrando que o Universo não possui um centro físico.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Informações da Época (Top-Left) */}
      <div className="absolute left-6 top-22 z-10 max-w-md rounded-2xl border border-slate-800/80 bg-[#030712]/65 backdrop-blur-md px-5 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.4)] text-slate-200 border-l-2 border-l-blue-500">
        <div className="flex items-center gap-2">
          <Timer size={12} className="text-blue-400 animate-pulse" />
          <div className="text-[9px] uppercase tracking-[0.22em] text-blue-400 font-bold">{profile.scaleLabel}</div>
          <div className="ml-auto font-mono text-[9px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800/60">{Math.round(progress)}%</div>
        </div>
        <div className="mt-2 text-base font-extrabold text-white tracking-tight">{profile.title}</div>
        <p className="mt-2 text-xs leading-relaxed text-slate-400 font-light">{profile.caption}</p>
      </div>

      {/* Status Cósmico (Top-Right) */}
      <div className="absolute right-6 top-22 z-10 hidden w-56 rounded-2xl border border-slate-800/80 bg-[#030712]/65 backdrop-blur-md px-5 py-4 text-xs text-slate-300 md:block shadow-[0_12px_40px_rgba(0,0,0,0.4)] border-r-2 border-r-indigo-500">
        <div className="mb-3 border-b border-slate-800 pb-2 text-[9px] uppercase tracking-[0.22em] text-indigo-400 font-bold flex items-center gap-2">
          <Sparkles size={12} className="text-indigo-400" />
          <span>Status Cósmico</span>
        </div>

        {/* Luz */}
        <div className="py-1.5">
          <div className="flex justify-between font-semibold text-[10px] text-slate-400 mb-1">
            <span>Luz</span>
            <span className="font-mono text-amber-200">{Math.round(profile.light * 100)}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-950/80 border border-slate-900/40 rounded-full overflow-hidden">
            <div 
              className="h-full bg-amber-300 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.65)] transition-all duration-500 ease-out"
              style={{ width: `${profile.light * 100}%` }}
            />
          </div>
        </div>

        {/* Gás */}
        <div className="py-1.5">
          <div className="flex justify-between font-semibold text-[10px] text-slate-400 mb-1">
            <span>Gás</span>
            <span className="font-mono text-indigo-300">{Math.round(profile.gas * 100)}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-950/80 border border-slate-900/40 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(129,140,248,0.65)] transition-all duration-500 ease-out"
              style={{ width: `${profile.gas * 100}%` }}
            />
          </div>
        </div>

        {/* Estrelas */}
        <div className="py-1.5">
          <div className="flex justify-between font-semibold text-[10px] text-slate-400 mb-1">
            <span>Estrelas</span>
            <span className="font-mono text-cyan-300">{Math.round(profile.stars * 100)}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-950/80 border border-slate-900/40 rounded-full overflow-hidden">
            <div 
              className="h-full bg-cyan-300 rounded-full shadow-[0_0_8px_rgba(103,232,249,0.65)] transition-all duration-500 ease-out"
              style={{ width: `${profile.stars * 100}%` }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export function CenterlessMarker() {
  const { activeMode } = useUniverseStore();
  if (activeMode !== 'centerless') return null;

  return (
    <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none whitespace-nowrap font-mono text-[9px] tracking-[0.25em] text-green-400 bg-green-950/20 border border-green-500/30 px-3.5 py-1.5 rounded-full shadow-[0_0_12px_rgba(74,222,128,0.15)] mt-8 uppercase font-bold animate-pulse">
      [ Observador Local ]
    </div>
  );
}
