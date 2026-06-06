import { motion } from 'framer-motion';
import { Play, Sparkles, Orbit, Milestone } from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
}

export default function LandingPage({ onStart }: LandingPageProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.14,
        delayChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring' as const, stiffness: 120, damping: 18 },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="absolute inset-0 z-50 flex flex-col justify-between p-8 md:p-12 overflow-y-auto bg-[#020205]/92 backdrop-blur-xl select-none"
    >
      {/* 1. Deep Space Vignette Mask (Ultra Dark Overlay) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_20%,rgba(1,1,3,0.98)_90%)] pointer-events-none z-0" />

      {/* 2. Soft Volumetric Nebula Glows (Faint and elegant behind center text) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[35%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-blue-500/6 blur-[130px] animate-pulse" />
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-indigo-500/5 blur-[90px] animate-pulse" style={{ animationDuration: '5s' }} />
      </div>

      {/* Top Header Logo */}
      <div className="w-full flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded-full border border-blue-400/40 bg-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.35)] animate-pulse" />
          <span className="text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">Cosmologia Interativa</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">v1.2.5 / NASA Data</span>
      </div>

      {/* Main Content Area */}
      <div className="my-auto py-10 flex flex-col items-center justify-center text-center z-10 max-w-4xl mx-auto">
        {/* Decorative Sci-Fi Badge */}
        <motion.div
          variants={itemVariants}
          className="px-3.5 py-1 rounded-full border border-blue-500/15 bg-blue-950/15 text-blue-400 text-[10px] font-bold uppercase tracking-[0.22em] mb-7 flex items-center gap-2"
        >
          <Sparkles className="h-3 w-3 text-blue-400 animate-pulse" />
          <span>Simulação Tridimensional Ativa</span>
        </motion.div>

        {/* Heading */}
        <motion.h1
          variants={itemVariants}
          className="text-5xl md:text-7xl lg:text-8xl font-black tracking-[-0.01em] text-white mb-6 leading-[1.05]"
        >
          <span className="text-[11px] block uppercase tracking-[0.38em] font-medium text-blue-300/60 mb-3">A história do</span>
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(96,165,250,0.22)]">
            UNIVERSO
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={itemVariants}
          className="text-sm md:text-base text-slate-400 max-w-xl mb-12 leading-relaxed font-light"
        >
          Explore a linha do tempo logarítmica cósmica, a mecânica gravitacional do Quasar central e a expansão homogênea do espaço.
        </motion.p>

        {/* Big Glow Button with outer pulse ring */}
        <motion.div variants={itemVariants} className="relative group">
          {/* Pulsing Backlight */}
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 opacity-20 blur-md group-hover:opacity-45 transition-opacity duration-300 animate-pulse" />
          
          <motion.button
            whileHover={{ scale: 1.04, boxShadow: '0 0 40px rgba(59, 130, 246, 0.45)' }}
            whileTap={{ scale: 0.98 }}
            onClick={onStart}
            className="relative px-12 py-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-full border border-blue-400/20 shadow-[0_0_20px_rgba(59,130,246,0.25)] transition-all duration-300 tracking-[0.18em] cursor-pointer uppercase text-[11px] flex items-center gap-3"
          >
            <Play className="h-3.5 w-3.5 fill-white group-hover:scale-110 transition-transform" />
            <span>Iniciar Simulação</span>
          </motion.button>
        </motion.div>
      </div>

      {/* Feature Cards Grid (Bottom) */}
      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5 z-10 shrink-0 mt-6">
        {/* Card 1 */}
        <motion.div
          variants={itemVariants}
          className="relative bg-[#070913]/40 border border-slate-900/80 hover:border-blue-500/20 rounded-2xl p-5 text-left transition-all duration-300 hover:bg-[#070913]/60 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)]"
        >
          {/* Glowing LED accent */}
          <div className="absolute top-3.5 right-3.5 h-1 w-1 rounded-full bg-blue-500/50 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
          
          <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 shadow-[0_0_12px_rgba(59,130,246,0.08)]">
            <Milestone className="h-4.5 w-4.5" />
          </div>
          <h3 className="text-white font-semibold text-xs mb-2 uppercase tracking-wider">Evolução Temporal</h3>
          <p className="text-slate-400 text-[11px] leading-relaxed font-light">
            Navegue por 13.8 bilhões de anos em uma escala temporal logarítmica, acompanhando o resfriamento térmico e a formação estrutural.
          </p>
        </motion.div>

        {/* Card 2 */}
        <motion.div
          variants={itemVariants}
          className="relative bg-[#070913]/40 border border-slate-900/80 hover:border-indigo-500/20 rounded-2xl p-5 text-left transition-all duration-300 hover:bg-[#070913]/60 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)]"
        >
          <div className="absolute top-3.5 right-3.5 h-1 w-1 rounded-full bg-indigo-500/50 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
          
          <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 shadow-[0_0_12px_rgba(99,102,241,0.08)]">
            <Orbit className="h-4.5 w-4.5" />
          </div>
          <h3 className="text-white font-semibold text-xs mb-2 uppercase tracking-wider">Gravidade e Jatos</h3>
          <p className="text-slate-400 text-[11px] leading-relaxed font-light">
            Observe o Quasar central desalinhado da galáxia hospedeira, com jatos relativísticos ativos e matéria orbitando sob gravidade física.
          </p>
        </motion.div>

        {/* Card 3 */}
        <motion.div
          variants={itemVariants}
          className="relative bg-[#070913]/40 border border-slate-900/80 hover:border-amber-500/20 rounded-2xl p-5 text-left transition-all duration-300 hover:bg-[#070913]/60 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)]"
        >
          <div className="absolute top-3.5 right-3.5 h-1 w-1 rounded-full bg-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
          
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 shadow-[0_0_12px_rgba(245,158,11,0.08)]">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <h3 className="text-white font-semibold text-xs mb-2 uppercase tracking-wider">Visual NASA</h3>
          <p className="text-slate-400 text-[11px] leading-relaxed font-light">
            Veja poeira interestelar e restos gasosos de supernovas (FBM na GPU) que flutuam ao fundo, reproduzindo imagens icônicas do Hubble e JWST.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
