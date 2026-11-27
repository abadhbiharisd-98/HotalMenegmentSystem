import { useState } from 'react'

export default function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient = 'linear-gradient(135deg, #fef08a 0%, #d4af37 50%, #996515 100%)',
  bgSoft = 'rgba(212, 175, 55, 0.12)',
  iconColor = '#fbbf24',
  badge,
  badgeColor = '#fde047',
  badgeBg = 'rgba(212, 175, 55, 0.15)',
  loading = false,
  delay = 0,
}) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      style={{
        ...styles.card,
        transform: isHovered ? 'translateY(-5px) scale(1.015)' : 'translateY(0) scale(1)',
        boxShadow: isHovered
          ? '0 16px 36px -4px rgba(0, 0, 0, 0.7), 0 0 25px rgba(212, 175, 55, 0.25)'
          : '0 8px 24px -2px rgba(0, 0, 0, 0.4), 0 0 10px rgba(212, 175, 55, 0.05)',
        borderColor: isHovered ? 'rgba(212, 175, 55, 0.7)' : 'rgba(212, 175, 55, 0.22)',
        animationDelay: `${delay}ms`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={styles.topRow}>
        <div style={styles.titleWrapper}>
          <span style={styles.title}>{title}</span>
          {badge && (
            <span
              style={{
                ...styles.badge,
                color: badgeColor,
                backgroundColor: badgeBg,
                borderColor: badgeColor,
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <div
          style={{
            ...styles.iconContainer,
            background: isHovered ? gradient : bgSoft,
            boxShadow: isHovered
              ? '0 0 18px rgba(212, 175, 55, 0.4)'
              : '0 0 8px rgba(212, 175, 55, 0.1)',
            transform: isHovered ? 'scale(1.08) rotate(4deg)' : 'scale(1)',
          }}
        >
          {Icon && (
            <Icon
              size={22}
              color={isHovered ? '#070a12' : iconColor}
              style={{ transition: 'all 0.25s ease' }}
            />
          )}
        </div>
      </div>

      <div style={styles.valueRow}>
        {loading ? (
          <div style={styles.skeleton} />
        ) : (
          <div style={styles.value}>{value}</div>
        )}
      </div>

      {subtitle && (
        <div style={styles.footerRow}>
          <span style={styles.subtitle}>{subtitle}</span>
        </div>
      )}
    </div>
  )
}

const styles = {
  card: {
    backgroundColor: '#090e1c',
    backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(212, 175, 55, 0.12) 0%, transparent 60%)',
    borderRadius: '18px',
    padding: '24px 22px',
    border: '1px solid rgba(212, 175, 55, 0.24)',
    boxShadow: '0 8px 24px -2px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(254, 240, 138, 0.12)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '14px',
    position: 'relative',
    overflow: 'hidden',
    transition: 'all 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
    animation: 'cardEntrance 0.5s ease-out backwards',
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: '12px',
    fontWeight: '800',
    color: '#cbd5e1',
    textTransform: 'uppercase',
    letterSpacing: '0.9px',
  },
  badge: {
    fontSize: '10px',
    fontWeight: '800',
    padding: '2px 8px',
    borderRadius: '9999px',
    lineHeight: '1.2',
    border: '1px solid',
  },
  iconContainer: {
    width: '46px',
    height: '46px',
    borderRadius: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: '1px solid rgba(212, 175, 55, 0.35)',
    transition: 'all 0.25s ease',
  },
  valueRow: {
    margin: '4px 0 0 0',
  },
  value: {
    fontSize: '30px',
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: '-0.8px',
    lineHeight: '1.1',
    textShadow: '0 2px 12px rgba(0, 0, 0, 0.6), 0 0 15px rgba(212, 175, 55, 0.15)',
  },
  footerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    borderTop: '1px solid rgba(212, 175, 55, 0.12)',
    paddingTop: '10px',
  },
  subtitle: {
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: '500',
  },
  skeleton: {
    width: '90px',
    height: '34px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    animation: 'pulse 1.5s infinite',
  },
}
