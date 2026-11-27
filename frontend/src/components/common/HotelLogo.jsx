export default function HotelLogo({ size = 42, showText = false, textVariant = 'default' }) {
  const emblemSize = size

  return (
    <div style={styles.container}>
      {/* Unique Royal Crest SVG Emblem */}
      <svg
        width={emblemSize}
        height={emblemSize}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={styles.svg}
      >
        <defs>
          {/* Metallic Gold Linear Gradients */}
          <linearGradient id="gdGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="25%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#d4af37" />
            <stop offset="75%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>

          <linearGradient id="gdDarkVelvet" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#151e36" />
            <stop offset="50%" stopColor="#0d1424" />
            <stop offset="100%" stopColor="#070a12" />
          </linearGradient>

          <linearGradient id="gdRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#d4af37" />
            <stop offset="100%" stopColor="#996515" />
          </linearGradient>

          {/* Golden Glow Filter */}
          <filter id="gdGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Circular Ring with subtle glow */}
        <circle
          cx="60"
          cy="60"
          r="56"
          stroke="url(#gdRingGradient)"
          strokeWidth="2"
          opacity="0.9"
          filter="url(#gdGlow)"
        />

        {/* Decorative Notched Ring */}
        <circle
          cx="60"
          cy="60"
          r="51"
          stroke="url(#gdRingGradient)"
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.6"
        />

        {/* Inner Shield / Velvet Dark Disc */}
        <circle cx="60" cy="60" r="47" fill="url(#gdDarkVelvet)" stroke="url(#gdGoldGradient)" strokeWidth="1.5" />

        {/* Royal Crown on Top of Crest */}
        <path
          d="M44 32 L47 43 L54 36 L60 45 L66 36 L73 43 L76 32 L78 47 L42 47 Z"
          fill="url(#gdGoldGradient)"
          filter="url(#gdGlow)"
        />
        {/* Crown Jewels (small golden spheres) */}
        <circle cx="44" cy="31" r="2" fill="#fffbeb" />
        <circle cx="54" cy="35" r="2" fill="#fffbeb" />
        <circle cx="60" cy="33" r="2.5" fill="#fef08a" />
        <circle cx="66" cy="35" r="2" fill="#fffbeb" />
        <circle cx="76" cy="31" r="2" fill="#fffbeb" />

        {/* Stylized Interlocking Monogram: G and D */}
        <g transform="translate(60, 68) scale(1.1)">
          {/* Letter G (Left graceful sweep) */}
          <path
            d="M -6 -16 C -18 -16 -24 -7 -24 3 C -24 14 -16 22 -5 22 C 3 22 10 17 12 11 L 1 11 C -1 15 -6 16 -8 16 C -14 16 -18 10 -18 3 C -18 -4 -13 -10 -6 -10 C -2 -10 2 -8 4 -5 L 9 -9 C 5 -13 0 -16 -6 -16 Z"
            fill="url(#gdGoldGradient)"
            filter="url(#gdGlow)"
          />
          {/* Letter D (Right regal arc) */}
          <path
            d="M 3 -16 L 3 22 L 10 22 C 22 22 26 14 26 3 C 26 -8 20 -16 10 -16 Z M 9 -10 L 10 -10 C 16 -10 20 -5 20 3 C 20 11 16 16 10 16 L 9 16 Z"
            fill="url(#gdGoldGradient)"
            filter="url(#gdGlow)"
          />
        </g>

        {/* Bottom Star & Laurel Flourish */}
        <path
          d="M 60 98 L 62 102 L 67 102 L 63 105 L 65 109 L 60 106 L 55 109 L 57 105 L 53 102 L 58 102 Z"
          fill="url(#gdGoldGradient)"
        />
        <circle cx="48" cy="103" r="1.5" fill="#d4af37" />
        <circle cx="72" cy="103" r="1.5" fill="#d4af37" />
      </svg>

      {/* Optional Accompanying Brand Text */}
      {showText && (
        <div style={styles.textContainer}>
          <div
            style={{
              ...styles.title,
              fontSize: textVariant === 'large' ? '20px' : '15px',
            }}
          >
            GITA DEVI HOTEL
          </div>
          <div style={styles.subtitle}>
            ★ ★ ★ ★ ★ ROYAL PALACE
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
  },
  svg: {
    flexShrink: 0,
    filter: 'drop-shadow(0 0 10px rgba(212, 175, 55, 0.35))',
    transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  textContainer: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: '1.2',
  },
  title: {
    fontWeight: '900',
    color: '#fef08a',
    letterSpacing: '1.5px',
    fontFamily: '"Cinzel", "Playfair Display", -apple-system, serif',
    textShadow: '0 0 14px rgba(212, 175, 55, 0.45)',
    whiteSpace: 'nowrap',
  },
  subtitle: {
    fontSize: '9.5px',
    fontWeight: '800',
    color: '#d4af37',
    letterSpacing: '1.2px',
    textTransform: 'uppercase',
    marginTop: '2px',
  },
}
