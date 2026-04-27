import { AnimatePresence, motion } from 'framer-motion';
import { Info, Thermometer, Timer } from 'lucide-react';
import { useUniverseStore } from '../store/useUniverseStore';
import { epochs } from '../data/epochs';

export default function EpochInfoPanel() {
  const { progress } = useUniverseStore();
  const currentEpoch = [...epochs].reverse().find((epoch) => progress >= epoch.progressMarker) || epochs[0];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentEpoch.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.28 }}
        className="flex h-full flex-col gap-7"
      >
        <section>
          <div className="sidebar-header">Epoca atual</div>
          <h2 className="text-3xl font-bold leading-tight text-white">{currentEpoch.name}</h2>
          <p className="mt-4 text-base leading-8 text-slate-300">{currentEpoch.description}</p>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="metric-panel">
            <Timer size={16} className="text-blue-300" />
            <div>
              <div className="sidebar-header mb-1">Idade</div>
              <div className="data-label">{currentEpoch.age}</div>
            </div>
          </div>
          <div className="metric-panel">
            <Thermometer size={16} className="text-amber-200" />
            <div>
              <div className="sidebar-header mb-1">Temperatura</div>
              <div className="data-label">{currentEpoch.temperature}</div>
            </div>
          </div>
        </section>

        <section className="mt-auto rounded-lg border border-blue-300/25 bg-blue-400/10 p-5 shadow-[0_0_40px_rgba(37,99,235,0.12)]">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-400 text-slate-950">
              <Info size={18} />
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">O que esta acontecendo?</span>
          </div>
          <p className="text-sm leading-7 text-blue-50">{currentEpoch.whatIsHappening}</p>
        </section>
      </motion.div>
    </AnimatePresence>
  );
}
