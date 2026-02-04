/**
 * Fluid, luminous wave animation for the hero section.
 * Layered SVG waves with animated gradients and motion.
 */
export function HeroWave() {
  const viewBox = '0 0 1440 320';
  // Organic wave path: rises and dips across the width (bottom-aligned fill)
  const wavePath =
    'M0,224L48,208C96,192,192,160,288,154.7C384,149,480,171,576,165.3C672,160,768,128,864,122.7C960,117,1056,139,1152,138.7C1248,139,1344,117,1392,106.7L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z';

  const wavePathAlt =
    'M0,288L60,272C120,256,240,224,360,213.3C480,203,600,213,720,197.3C840,181,960,139,1080,128C1200,117,1320,139,1380,149.3L1440,160L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z';

  const wavePathFront =
    'M0,256L40,245.3C80,235,160,213,240,197.3C320,181,400,171,480,181.3C560,192,640,224,720,224C800,224,880,192,960,181.3C1040,171,1120,181,1200,186.7C1280,192,1360,192,1400,192L1440,192L1440,320L1400,320C1360,320,1280,320,1200,320C1120,320,1040,320,960,320C880,320,800,320,720,320C640,320,560,320,480,320C400,320,320,320,240,320C160,320,80,320,40,320L0,320Z';

  return (
    <div className="hero-wave-wrap" aria-hidden="true">
      <svg
        className="hero-wave-svg"
        viewBox={viewBox}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Animated gradient — flows for iridescent effect */}
          <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee">
              <animate attributeName="stop-color" values="#22d3ee;#a78bfa;#c084fc;#22d3ee" dur="8s" repeatCount="indefinite" />
            </stop>
            <stop offset="35%" stopColor="#a78bfa">
              <animate attributeName="stop-color" values="#a78bfa;#c084fc;#22d3ee;#a78bfa" dur="8s" repeatCount="indefinite" />
            </stop>
            <stop offset="70%" stopColor="#c084fc">
              <animate attributeName="stop-color" values="#c084fc;#e879f9;#a78bfa;#c084fc" dur="8s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#06b6d4">
              <animate attributeName="stop-color" values="#06b6d4;#22d3ee;#a78bfa;#06b6d4" dur="8s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          <linearGradient id="wave-gradient-back" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="wave-gradient-front" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="25%" stopColor="#e879f9" />
            <stop offset="50%" stopColor="#22d3ee" />
            <stop offset="75%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
          {/* Glow filter */}
          <filter id="wave-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.4  0 0 0 0 0.2  0 0 0 0 0.8  0 0 0 0.5 0" result="glow" />
            <feBlend in="SourceGraphic" in2="glow" mode="screen" />
          </filter>
          <filter id="wave-soft-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.6  0 0 0 0 0.4  0 0 0 0 1  0 0 0 0.4 0" result="glow" />
            <feBlend in="SourceGraphic" in2="glow" mode="screen" />
          </filter>
        </defs>
        {/* Back layer — slow, soft */}
        <path
          className="hero-wave-path hero-wave-path-back"
          d={wavePath}
          fill="url(#wave-gradient-back)"
        />
        {/* Middle layer — main gradient + motion */}
        <path
          className="hero-wave-path hero-wave-path-mid"
          d={wavePathAlt}
          fill="url(#wave-gradient)"
          filter="url(#wave-soft-glow)"
        />
        {/* Front layer — brighter, faster drift */}
        <path
          className="hero-wave-path hero-wave-path-front"
          d={wavePathFront}
          fill="url(#wave-gradient-front)"
          filter="url(#wave-glow)"
        />
      </svg>
    </div>
  );
}
