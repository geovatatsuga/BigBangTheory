import { AnimatePresence, motion } from 'framer-motion';
import { useUniverseStore } from '../store/useUniverseStore';

export default function ModeExplanations() {
  const { activeMode } = useUniverseStore();

  return (
    <div className="absolute left-8 top-24 z-10 max-w-sm pointer-events-none">
      <AnimatePresence mode="wait">
        {activeMode === 'centerless' && (
          <motion.div
            key="centerless"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="glass rounded-lg p-5 shadow-2xl"
          >
            <h3 className="mb-2 flex items-center gap-2 font-semibold text-blue-300">
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
              Universo sem centro
            </h3>
            <p className="mb-4 text-sm leading-relaxed text-slate-300">
              Clique em outra galaxia para virar o observador. As linhas mostram que, de qualquer ponto, as galaxias distantes parecem se afastar.
            </p>
            <div className="font-mono text-xs uppercase tracking-widest text-slate-500">
              [ orbite, aproxime e compare observadores ]
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
