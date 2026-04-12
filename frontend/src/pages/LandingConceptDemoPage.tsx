import React, { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { ChevronDown, ArrowRight, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";

const GraphSpineSVG = ({ scrollYProgress }: { scrollYProgress: any }) => {
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 30,
  });
  const mainPathLength = useTransform(
    smoothProgress,
    [0, 0.1, 0.7, 1],
    [0, 0.01, 0.55, 1],
  );
  const branchPathLength = useTransform(mainPathLength, [0.24, 0.7], [0, 1]);

  const mainPath = "M 500 0 L 500 4000";
  const branchPath =
    "M 500 960 C 500 1120, 600 1180, 600 1420 L 600 2260 C 600 2480, 500 2520, 500 2800";

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      viewBox="0 0 1000 4000"
      preserveAspectRatio="none"
    >
      <defs>
        <filter
          id="glow-main"
          filterUnits="userSpaceOnUse"
          x="452"
          y="-120"
          width="96"
          height="4240"
        >
          <feGaussianBlur stdDeviation="4.5" result="blur" />
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

      <path
        d={mainPath}
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="4"
      />
      <path
        d={branchPath}
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="4"
      />

      <motion.path
        d={mainPath}
        fill="none"
        stroke="#fb923c"
        strokeWidth="5"
        strokeLinecap="round"
        filter="url(#glow-main)"
        style={{ pathLength: mainPathLength }}
      />

      <motion.circle
        r="7"
        fill="rgba(251,146,60,0.12)"
        style={{
          offsetPath: `path('${mainPath}')`,
          offsetDistance: useTransform(mainPathLength, (v) => `${v * 100}%`),
        }}
      />
      <motion.circle
        r="4.75"
        fill="#fff"
        stroke="rgba(251,146,60,0.85)"
        strokeWidth="1.35"
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
          opacity: useTransform(mainPathLength, [0.24, 0.28], [0, 1]),
        }}
      />
      <motion.circle
        r="7"
        fill="rgba(236,72,153,0.12)"
        style={{
          offsetPath: `path('${branchPath}')`,
          offsetDistance: useTransform(branchPathLength, (v) => `${v * 100}%`),
          opacity: useTransform(
            branchPathLength,
            [0, 0.01, 0.99, 1],
            [0, 1, 1, 0],
          ),
        }}
      />
      <motion.circle
        r="4.75"
        fill="#fff"
        stroke="rgba(236,72,153,0.9)"
        strokeWidth="1.35"
        style={{
          offsetPath: `path('${branchPath}')`,
          offsetDistance: useTransform(branchPathLength, (v) => `${v * 100}%`),
          opacity: useTransform(
            branchPathLength,
            [0, 0.01, 0.99, 1],
            [0, 1, 1, 0],
          ),
        }}
      />
    </svg>
  );
};

const GraphNode = ({
  targetProgress,
  xPos,
  color,
  title,
  subtitle,
  desc,
  side,
  scrollYProgress,
}: any) => {
  const isLeft = side === "left";
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 30,
  });
  const mainPathLength = useTransform(
    smoothProgress,
    [0, 0.1, 0.7, 1],
    [0, 0.01, 0.55, 1],
  );

  const nodeScale = useTransform(
    mainPathLength,
    [targetProgress - 0.025, targetProgress, targetProgress + 0.04],
    [0.92, 1.6, 1],
  );
  const nodeOpacity = useTransform(
    mainPathLength,
    [targetProgress - 0.04, targetProgress],
    [0.35, 1],
  );
  const cardOpacity = useTransform(
    mainPathLength,
    [targetProgress - 0.035, targetProgress + 0.015],
    [0, 1],
  );
  const cardY = useTransform(
    mainPathLength,
    [targetProgress - 0.035, targetProgress + 0.015],
    [18, 0],
  );

  return (
    <div
      className="absolute w-full h-0 z-10"
      style={{ top: `${targetProgress * 100}%` }}
    >
      <div
        className="absolute w-6 h-6 -mt-3 -ml-3 rounded-full border-[4px] border-[#050505] flex items-center justify-center"
        style={{
          left: `${xPos}%`,
          backgroundColor: color,
          boxShadow: `0 0 25px ${color}`,
        }}
      >
        <motion.div
          className="absolute inset-0 rounded-full border-[2px] bg-transparent"
          style={{ scale: nodeScale, opacity: nodeOpacity, borderColor: color }}
        />
      </div>

      <motion.div
        className={`absolute w-[40%] flex flex-col ${isLeft ? "items-end text-right" : "items-start text-left"}`}
        style={{
          [isLeft ? "right" : "left"]: `${isLeft ? 100 - xPos : xPos}%`,
          [isLeft ? "marginRight" : "marginLeft"]: "50px",
          transform: "translateY(-50%)",
          opacity: cardOpacity,
          y: cardY,
        }}
      >
        <div
          className={`flex items-center gap-3 mb-4 ${isLeft ? "justify-end" : "justify-start"} w-full`}
        >
          <span
            className="text-[11px] font-mono font-black tracking-widest"
            style={{ color }}
          >
            {subtitle.split(" — ")[0]}
          </span>
          <div className="h-[1px] w-10 bg-white/20" />
          <span className="text-[10px] font-mono text-white/30 uppercase tracking-[0.2em]">
            {subtitle.split(" — ")[1]}
          </span>
        </div>
        <h3
          className={`text-4xl md:text-6xl font-black text-white tracking-tighter uppercase italic drop-shadow-xl ${desc ? "mb-6" : "mb-0"}`}
        >
          {title}
        </h3>
        {desc ? (
          <p className="text-gray-500 text-sm md:text-lg font-light leading-relaxed max-w-sm">
            {desc}
          </p>
        ) : null}
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
    offset: ["start 80%", "end end"],
  });

  const badFiles = [
    "이력서(최종)",
    "이력서(찐최종)",
    "이력서(찐찐최종)",
    "이력서(진짜최종이거임최종)",
  ];

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate("/documents");
      return;
    }
    navigate("/signup");
  };

  return (
    <div className="bg-[#050505] text-white font-sans selection:bg-orange-500 selection:text-white overflow-x-hidden antialiased">
      <section className="relative z-20 flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
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
                  transition={{
                    delay: 2.2 + i * 0.1,
                    duration: 0.3,
                    ease: "easeOut",
                  }}
                  className="absolute top-1/2 left-[-5%] w-[110%] h-[2px] bg-red-500 origin-left drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                />
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 4.2, duration: 0.8, type: "spring" }}
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <div className="w-16 h-16 bg-orange-500 rounded-full shadow-[0_0_50px_rgba(249,115,22,0.6)] border-[6px] border-[#050505] flex items-center justify-center mb-6">
              <CheckCircle2 size={24} className="text-[#050505]" />
            </div>
            <div className="text-orange-400 font-mono font-bold tracking-widest text-sm bg-orange-500/10 px-6 py-2 rounded-full border border-orange-500/30">
              Docsa v1.0
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 5, duration: 1 }}
        >
          <h1
            className="mb-8 text-6xl font-black leading-[0.96] tracking-tight md:text-[7.75rem]"
            style={{
              fontFamily:
                '"SF Pro Display","SUIT Variable","Pretendard Variable","Apple SD Gothic Neo",sans-serif',
            }}
          >
            버전 관리의 악몽, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-pink-500 to-orange-600 drop-shadow-[0_10px_30px_rgba(249,115,22,0.4)]">
              이제 끝내다.
            </span>
          </h1>
          <p className="mx-auto mb-16 max-w-3xl text-xl font-light leading-relaxed text-gray-400 md:text-2xl">
            더 이상 파일 이름 뒤에 '진짜최종'을 붙이지 마세요. <br />
            Docsa는 초안, 기록, 분기, 병합까지 문서의 흐름을 한눈에 정리합니다.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={handleGetStarted}
              className="group flex items-center gap-3 rounded-sm bg-white px-16 py-6 text-sm font-black text-black shadow-[0_20px_50px_rgba(249,115,22,0.2)] transition-all hover:bg-orange-500 hover:text-white md:px-20 md:py-7 md:text-base"
            >
              시작하기{" "}
              <ArrowRight
                className="transition-transform group-hover:translate-x-1"
                size={18}
              />
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.2, 0.6, 0.2] }}
          transition={{ delay: 6, repeat: Infinity, duration: 2 }}
          className="absolute bottom-10 flex flex-col items-center gap-4"
        >
          <span className="text-[10px] font-black tracking-[0.5em] uppercase text-orange-500">
            Scroll Down to Trace
          </span>
          <ChevronDown size={24} className="text-orange-500" />
        </motion.div>
      </section>

      <section
        ref={containerRef}
        className="relative w-full max-w-[1200px] mx-auto h-[300vh] mb-40"
      >
        <GraphSpineSVG scrollYProgress={scrollYProgress} />

        <GraphNode
          targetProgress={0.12}
          xPos={50}
          color="#f97316"
          side="left"
          subtitle="WRITE — WORKSPACE"
          title="문서 작성"
          desc="워크스테이션에서 블록 기반의 편리한 문서작성이 가능합니다. 자동저장 기능으로 작업물이 날아가지 않습니다 :)"
          scrollYProgress={scrollYProgress}
        />

        <GraphNode
          targetProgress={0.24}
          xPos={50}
          color="#f97316"
          side="left"
          subtitle="COMMIT — SNAPSHOT"
          title="기록 남기기"
          desc="의미 있는 시점마다 문서 상태를 기록으로 남깁니다. 어떤 내용이 언제 만들어졌는지 흐름으로 남아 작업 과정과 결과를 함께 관리할 수 있습니다."
          scrollYProgress={scrollYProgress}
        />

        <GraphNode
          targetProgress={0.36}
          xPos={60}
          color="#ec4899"
          side="right"
          subtitle="BRANCH — SAFE DRAFT"
          title="무한한 버전생성"
          desc="하나의 원본 기록에서 분기를 분리하여 여러 맥락의 버전을 만들어 관리할 수 있습니다. 메인 문서는 그대로 보존하고 수정안을 안전하게 이어갈 수 있습니다."
          scrollYProgress={scrollYProgress}
        />

        <GraphNode
          targetProgress={0.5}
          xPos={60}
          color="#ec4899"
          side="right"
          subtitle="COMPARE — REVIEW"
          title="비교와 검토"
          desc="서로 다른 기록을 텍스트 기준으로 비교해 차이를 확인합니다. 어떤 문장과 단어가 바뀌었는지 빠르게 파악할 수 있습니다."
          scrollYProgress={scrollYProgress}
        />

        <GraphNode
          targetProgress={0.7}
          xPos={50}
          color="#f97316"
          side="left"
          subtitle="MERGE — BACK TO MAIN"
          title="확인 후 병합"
          desc="각 기록에서 필요한 부분만 선택해 새로운 작업장으로 합칩니다. 비교와 병합이 한 화면에서 이어지므로 흐름을 끊지 않고 문서를 정리할 수 있습니다."
          scrollYProgress={scrollYProgress}
        />
      </section>

      <section className="relative min-h-[80vh] flex flex-col items-center justify-center text-center px-6 border-t border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.08)_0%,transparent_60%)]" />
        <h2
          className="relative z-10 mb-12 text-7xl font-black leading-[0.88] tracking-tight md:text-[9rem]"
          style={{
            fontFamily:
              '"SF Pro Display","SUIT Variable","Pretendard Variable","Apple SD Gothic Neo",sans-serif',
          }}
        >
          From Draft <br />
          <span className="text-orange-500 drop-shadow-[0_0_50px_rgba(234,88,12,0.4)]">
            to Decision.
          </span>
        </h2>
        <button
          onClick={handleGetStarted}
          className="relative z-10 group flex items-center gap-3 rounded-sm bg-white px-16 py-6 text-sm font-black text-black shadow-[0_20px_50px_rgba(249,115,22,0.2)] transition-all hover:bg-orange-500 hover:text-white md:px-20 md:py-7 md:text-base"
        >
          시작하기{" "}
          <ArrowRight
            className="transition-transform group-hover:translate-x-1"
            size={18}
          />
        </button>
      </section>

      <footer className="bg-[#050505] py-12 text-center text-sm text-white/35">
        <p>Docsa, 문서 버전의 흐름을 정리합니다.</p>
      </footer>
    </div>
  );
}
