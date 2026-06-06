import { useState } from 'react';
import UniverseSimulator from './components/UniverseSimulator';
import TimelineSlider from './components/TimelineSlider';
import PlayControls from './components/PlayControls';
import ControlModes from './components/ControlModes';
import ModeExplanations from './components/ModeExplanations';
import LandingPage from './components/LandingPage';
import { useUniverseStore } from './store/useUniverseStore';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [started, setStarted] = useState(false);
  const { activeMode, progress, isPlaying, setIsPlaying } = useUniverseStore();

  return (
    <div className="w-screen h-screen relative overflow-hidden bg-[#020205] selection:bg-blue-500/30">
      <AnimatePresence>
        {!started && (
          <LandingPage onStart={() => setStarted(true)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {started && (
          <motion.header
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 16 }}
            className="absolute top-4 left-6 right-6 h-14 flex items-center justify-between px-6 rounded-2xl border border-slate-800/80 bg-[#030712]/68 backdrop-blur-md z-20 shadow-[0_12px_40px_rgba(0,0,0,0.3)]"
          >
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full border border-blue-400/40 bg-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.35)] animate-pulse" />
              <h1 className="text-sm font-bold text-white tracking-wide">
                Cosmologia Interativa <span className="hidden text-blue-400 font-light sm:inline">/ Historia do Universo</span>
              </h1>
            </div>
            <ControlModes />
          </motion.header>
        )}
      </AnimatePresence>

      <div className="w-full h-full absolute inset-0 z-0">
        <UniverseSimulator />
      </div>

      {/* Película escura tutorial para o botão Play */}
      <AnimatePresence>
        {started && progress === 0 && !isPlaying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/82 backdrop-blur-[2px] z-10 flex flex-col justify-end p-20 pointer-events-none"
          >
            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-auto">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="bg-slate-900/90 border border-slate-800/80 p-6 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] max-w-sm text-center backdrop-blur-md"
              >
                <h3 className="text-lg font-bold text-white mb-2">Singularidade do Universo</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  O tempo está congelado no instante zero. Clique no botão de reprodução azul abaixo para dar início ao Big Bang e expandir o Universo!
                </p>
                <button
                  onClick={() => setIsPlaying(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all shadow-[0_0_12px_rgba(37,99,235,0.3)] cursor-pointer"
                >
                  Entendi, Iniciar!
                </button>
              </motion.div>
            </div>

            {/* Seta e anel de brilho apontando para o botão Play no rodapé */}
            <div className="absolute bottom-[28px] left-[46px] w-[50px] h-[50px] flex items-center justify-center pointer-events-none">
              <span className="absolute w-[60px] h-[60px] rounded-full border-2 border-blue-500 animate-ping opacity-75" />
              <span className="absolute w-[44px] h-[44px] rounded-full border border-blue-400 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.5)] animate-pulse" />
              
              {/* Seta flutuante com texto */}
              <div className="absolute bottom-[68px] left-[10px] flex flex-col items-center gap-1.5 animate-bounce">
                <span className="text-[10px] font-extrabold text-blue-400 tracking-wider bg-slate-900/90 border border-blue-500/30 py-1 px-2.5 rounded-md shadow-lg whitespace-nowrap">
                  CLIQUE AQUI PARA INICIAR
                </span>
                <svg className="w-5.5 h-5.5 text-blue-400 drop-shadow-[0_0_4px_rgba(59,130,246,0.6)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {started && activeMode === 'timeline' && (
          <motion.footer
            initial={{ y: 140, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 140, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 16 }}
            className="absolute bottom-4 left-6 right-6 h-28 border border-slate-800/80 bg-[#030712]/68 backdrop-blur-md px-6 rounded-2xl z-20 shadow-[0_-12px_48px_rgba(0,0,0,0.35)] grid grid-cols-[auto_1fr] items-center gap-6"
          >
            <PlayControls />
            <TimelineSlider />
          </motion.footer>
        )}
      </AnimatePresence>
    </div>
  );
}
