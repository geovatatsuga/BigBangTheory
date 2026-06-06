import { useUniverseStore } from '../store/useUniverseStore';

export default function ControlModes() {
  const { activeMode, setActiveMode } = useUniverseStore();

  return (
    <nav className="flex bg-slate-950/80 border border-slate-900/40 p-0.5 rounded-full text-[11px] font-semibold shadow-inner">
      <button
        onClick={() => setActiveMode('timeline')}
        className={`px-5 py-1.5 rounded-full transition-all duration-200 cursor-pointer ${
          activeMode === 'timeline'
            ? 'bg-blue-600 text-white font-bold shadow-[0_0_12px_rgba(37,99,235,0.4)]'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        Simulador
      </button>
      <button
        onClick={() => setActiveMode('centerless')}
        className={`px-5 py-1.5 rounded-full transition-all duration-200 cursor-pointer ${
          activeMode === 'centerless'
            ? 'bg-blue-600 text-white font-bold shadow-[0_0_12px_rgba(37,99,235,0.4)]'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        Expansão sem Centro
      </button>
    </nav>
  );
}
