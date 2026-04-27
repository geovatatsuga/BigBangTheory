import { useUniverseStore } from '../store/useUniverseStore';

export default function ControlModes() {
  const { activeMode, setActiveMode } = useUniverseStore();

  return (
    <nav className="flex gap-6 text-sm font-medium">
      <button
        onClick={() => setActiveMode('timeline')}
        className={`transition-colors pb-1 ${
          activeMode === 'timeline'
            ? 'text-blue-400 border-b-2 border-blue-400'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        Simulador
      </button>
      <button
        onClick={() => setActiveMode('centerless')}
        className={`transition-colors pb-1 ${
          activeMode === 'centerless'
            ? 'text-blue-400 border-b-2 border-blue-400'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        Expansao sem Centro
      </button>
    </nav>
  );
}
