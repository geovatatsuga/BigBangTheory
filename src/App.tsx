import UniverseSimulator from './components/UniverseSimulator';
import TimelineSlider from './components/TimelineSlider';
import PlayControls from './components/PlayControls';
import ControlModes from './components/ControlModes';
import ModeExplanations from './components/ModeExplanations';
import { useUniverseStore } from './store/useUniverseStore';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const { activeMode } = useUniverseStore();

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden cosmic-bg selection:bg-blue-500/30">
      <header className="h-14 flex items-center justify-between px-7 nav-shell z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-full border border-blue-300/30 bg-blue-400/10 shadow-[0_0_18px_rgba(59,130,246,0.28)]" />
          <h1 className="text-lg font-bold text-white">
            Cosmologia Interativa <span className="hidden text-blue-300 font-light sm:inline">/ Historia do Universo</span>
          </h1>
        </div>
        <ControlModes />
      </header>

      <main className="flex-1 overflow-hidden relative">
        <UniverseSimulator />
        <ModeExplanations />
      </main>

      <AnimatePresence>
        {activeMode === 'timeline' && (
          <motion.footer
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            className="h-20 timeline-shell px-7 z-20 shrink-0 grid grid-cols-[auto_1fr] items-center gap-5"
          >
            <PlayControls />
            <TimelineSlider />
          </motion.footer>
        )}
      </AnimatePresence>
    </div>
  );
}
