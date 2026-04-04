import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { ChevronDown, GitCommit, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';

const GraphSpineSVG = ({ scrollYProgress }: { scrollYProgress: any }) => {
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 80, damping: 30 });
  const mainPathLength = useTransform(smoothProgress, [0, 1], [0.15, 0.95]);
  const branchPathLength = useTransform(mainPathLength, [0.125, 0.875], [0, 1]);

  const mainPath = 'M 500 0 L 500 4000';
  const branchPath = 'M 500 500 C 500 900, 600 900, 600 1300 L 600 2700 C 600 3100, 500 3100, 500 3500';

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      viewBox="0 0 1000 4000"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="glow-main" filterUnits="userSpaceOnUse" x="452" y="-120" width="96" height="4240">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glow-branch" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path d={mainPath} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
      <path d={branchPath} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />

      <motion.path
        d={mainPath}
        fill="none"
        stroke="#fb923c"
        strokeWidth="6"
        strokeLinecap="round"
        filter="url(#glow-main)"
        style={{ pathLength: mainPathLength }}
      />

      <motion.circle
        r="5"
        fill="#fff"
        style={{
          offsetPath: `path('${mainPath}')`,
          offsetDistance: useTransform(mainPathLength, (v) => `${v * 100}%`),
        }}
      />

      <motion.path
        d={branchPath}
        fill="none"
        stroke="#ec4899"
        strokeWidth="5"
        strokeLinecap="round"
        filter="url(#glow-branch)"
        style={{
          pathLength: branchPathLength,
          opacity: useTransform(mainPathLength, [0.12, 0.13], [0, 1]),
        }}
      />
      <motion.circle
        r="5"
        fill="#fff"
        style={{
          offsetPath: `path('${branchPath}')`,
          offsetDistance: useTransform(branchPathLength, (v) => `${v * 100}%`),
          opacity: useTransform(branchPathLength, [0, 0.01, 0.99, 1], [0, 1, 1, 0]),
        }}
      />
    </svg>
  );
};

const GraphNode = ({ targetProgress, xPos, color, title, subtitle, desc, side, scrollYProgress }: any) => {
  const isLeft = side === 'left';
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 80, damping: 30 });
  const mainPathLength = useTransform(smoothProgress, [0, 1], [0.15, 0.95]);

  const nodeScale = useTransform(mainPathLength, [targetProgress - 0.05, targetProgress, targetProgress + 0.05], [0.8, 2, 1]);
  const nodeOpacity = useTransform(mainPathLength, [targetProgress - 0.1, targetProgress], [0.2, 1]);
  const cardOpacity = useTransform(mainPathLength, [targetProgress - 0.1, targetProgress], [0, 1]);
  const cardY = useTransform(mainPathLength, [targetProgress - 0.1, targetProgress], [30, 0]);

  return (
    <div className="absolute w-full h-0 z-10" style={{ top: `${targetProgress * 100}%` }}>
      <div
        className="absolute w-6 h-6 -mt-3 -ml-3 rounded-full border-[4px] border-[#050505] flex items-center justify-center"
        style={{ left: `${xPos}%`, backgroundColor: color, boxShadow: `0 0 25px ${color}` }}
      >
        <motion.div
          className="absolute inset-0 rounded-full border-[2px] bg-transparent"
          style={{ scale: nodeScale, opacity: nodeOpacity, borderColor: color }}
        />
      </div>

      <motion.div
        className={`absolute w-[40%] flex flex-col ${isLeft ? 'items-end text-right' : 'items-start text-left'}`}
        style={{
          [isLeft ? 'right' : 'left']: `${isLeft ? 100 - xPos : xPos}%`,
          [isLeft ? 'marginRight' : 'marginLeft']: '50px',
          transform: 'translateY(-50%)',
          opacity: cardOpacity,
          y: cardY,
        }}
      >
        <div className={`flex items-center gap-3 mb-4 ${isLeft ? 'justify-end' : 'justify-start'} w-full`}>
          <span className="text-[11px] font-mono font-black tracking-widest" style={{ color }}>
            {subtitle.split(' — ')[0]}
          </span>
          <div className="h-[1px] w-10 bg-white/20" />
          <span className="text-[10px] font-mono text-white/30 uppercase tracking-[0.2em]">
            {subtitle.split(' — ')[1]}
          </span>
        </div>
        <h3 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tighter uppercase italic drop-shadow-xl">
          {title}
        </h3>
        <p className="text-gray-500 text-sm md:text-lg font-light leading-relaxed max-w-sm">{desc}</p>
      </motion.div>
    </div>
  );
};

export default function LandingConceptDemoPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const badFiles = [
    '문서집계표(최종).HWP',
    '문서집계표(최종수정컨펌).HWP',
    '문서집계표(진짜최종).HWP',
    '문서집계표(회장님지시수정).HWP',
  ];

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/documents');
      return;
    }
    navigate('/signup');
  };

  return (
    <div className="bg-[#050505] text-white font-sans selection:bg-orange-500 selection:text-white overflow-x-hidden antialiased">
      <nav className="fixed top-0 w-full z-50 px-10 py-8 flex justify-between items-center bg-[#050505]/60 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 bg-white text-black flex items-center justify-center font-black rounded-sm text-xl italic">D</div>
          <span className="text-2xl font-black tracking-widest uppercase italic">Docsa</span>
        </div>
        <div className="flex gap-8 text-[10px] font-bold tracking-[0.3em] uppercase text-white/50">
          <button className="hover:text-white transition-colors flex items-center gap-2" onClick={() => navigate('/demo/working-save-flow')}>
            <GitCommit size={14} />
            Node Mesh
          </button>
          <button
            onClick={handleGetStarted}
            className="px-6 py-2 bg-white text-black font-black rounded-full hover:bg-orange-500 hover:text-white transition-all"
          >
            Get Started
          </button>
        </div>
      </nav>

      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-20 z-20 overflow-hidden">
        <div className="relative w-full max-w-md mx-auto mb-16 h-[200px] flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: 3.5, duration: 0.8 }}
            className="absolute inset-0 flex flex-col items-center justify-center space-y-3 font-mono text-gray-500 text-sm md:text-base opacity-80"
          >
            {badFiles.map((file, i) => (
              <motion.div
                key={file}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.3 }}
                className="relative"
              >
                {file}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 2.2 + i * 0.1, duration: 0.3, ease: 'easeOut' }}
                  className="absolute top-1/2 left-[-5%] w-[110%] h-[2px] bg-red-500 origin-left drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                />
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 4.2, duration: 0.8, type: 'spring' }}
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <div className="w-16 h-16 bg-orange-500 rounded-full shadow-[0_0_50px_rgba(249,115,22,0.6)] border-[6px] border-[#050505] flex items-center justify-center mb-6">
              <CheckCircle2 size={24} className="text-[#050505]" />
            </div>
            <div className="text-orange-400 font-mono font-bold tracking-widest text-sm bg-orange-500/10 px-6 py-2 rounded-full border border-orange-500/30">
              단 하나의 완벽한 진실 (V_2.0)
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 5, duration: 1 }}>
          <h1 className="text-5xl md:text-[7rem] font-black leading-[1] tracking-tighter uppercase italic mb-8">
            버전 관리의 악몽, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-pink-500 to-orange-600 drop-shadow-[0_10px_30px_rgba(249,115,22,0.4)]">
              이제 끝내다.
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-gray-400 text-lg md:text-xl font-light leading-relaxed mb-16">
            더 이상 파일 이름 뒤에 '(진짜최종)'을 붙이며 고통받지 마세요. <br />
            Docsa의 유기적인 시각화 엔진이 문서의 모든 흐름을 통제합니다.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={handleGetStarted}
              className="px-16 py-6 bg-white text-black font-black rounded-sm hover:bg-orange-500 hover:text-white transition-all shadow-[0_20px_50px_rgba(249,115,22,0.2)] tracking-[0.4em] uppercase text-xs group flex items-center gap-3"
            >
              Initialize Project <ArrowRight className="group-hover:translate-x-1 transition-transform" size={16} />
            </button>
            <button
              onClick={() => navigate('/demo/working-save-flow')}
              className="rounded-sm border border-white/15 bg-white/5 px-10 py-6 text-xs font-black uppercase tracking-[0.35em] text-white transition-all hover:border-orange-500 hover:text-orange-300"
            >
              Open Demo
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.2, 0.6, 0.2] }}
          transition={{ delay: 6, repeat: Infinity, duration: 2 }}
          className="absolute bottom-10 flex flex-col items-center gap-4"
        >
          <span className="text-[10px] font-black tracking-[0.5em] uppercase text-orange-500">Scroll Down to Trace</span>
          <ChevronDown size={24} className="text-orange-500" />
        </motion.div>
      </section>

      <section ref={containerRef} className="relative w-full max-w-[1200px] mx-auto h-[400vh] mb-40">
        <GraphSpineSVG scrollYProgress={scrollYProgress} />

        <GraphNode
          targetProgress={0.125}
          xPos={50}
          color="#f97316"
          side="left"
          subtitle="V1.0.0 — GENESIS"
          title="완벽한 원본"
          desc="오렌지색 메인 라인은 절대 훼손되지 않는 단 하나의 진실입니다. 위에서부터 그려지는 흐름을 따라오세요."
          scrollYProgress={scrollYProgress}
        />

        <GraphNode
          targetProgress={0.375}
          xPos={60}
          color="#ec4899"
          side="right"
          subtitle="FEAT/01 — BRANCH OUT"
          title="안전한 분기"
          desc="메인 노드에서 핑크색 브랜치가 뻗어 나옵니다. 원본을 건드리지 않고 새로운 아이디어를 실험할 수 있는 독립된 공간입니다."
          scrollYProgress={scrollYProgress}
        />

        <GraphNode
          targetProgress={0.625}
          xPos={60}
          color="#ec4899"
          side="right"
          subtitle="FEAT/02 — COMMIT"
          title="데이터 축적"
          desc="파일명 복사 대신, 이 핑크색 브랜치 위에 수정 사항들이 차곡차곡 쌓입니다. 시각적으로 명확하게 구분됩니다."
          scrollYProgress={scrollYProgress}
        />

        <GraphNode
          targetProgress={0.875}
          xPos={50}
          color="#f97316"
          side="left"
          subtitle="V2.0.0 — MERGE"
          title="완벽한 통합"
          desc="수정이 끝난 핑크색 브랜치가 다시 오렌지색 메인 축으로 빨려 들어가며 완벽하게 병합됩니다. '진짜최종'은 이렇게 탄생합니다."
          scrollYProgress={scrollYProgress}
        />
      </section>

      <section className="relative min-h-[80vh] flex flex-col items-center justify-center text-center px-6 border-t border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.08)_0%,transparent_60%)]" />
        <h2 className="text-6xl md:text-[9rem] font-black uppercase italic mb-12 leading-[0.85] tracking-tighter relative z-10">
          Control <br />
          <span className="text-orange-500 drop-shadow-[0_0_50px_rgba(234,88,12,0.4)]">Evolution.</span>
        </h2>
        <button
          onClick={handleGetStarted}
          className="px-16 py-6 bg-white text-black font-black rounded-sm hover:bg-orange-500 hover:text-white transition-all shadow-[0_20px_50px_rgba(249,115,22,0.2)] tracking-[0.4em] uppercase text-xs relative z-10 group flex items-center gap-3"
        >
          Initialize Project <ArrowRight className="group-hover:translate-x-1 transition-transform" size={16} />
        </button>
      </section>

      <footer className="py-12 text-center flex flex-col items-center gap-4 opacity-40 bg-[#050505]">
        <p className="text-[10px] font-mono tracking-[0.8em] uppercase">Docsa Protocol Concept © 2026</p>
      </footer>
    </div>
  );
}
