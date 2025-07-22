// portall/client/src/components/dashboard/DashboardStats.jsx
import { useMemo } from 'react'

/**
 * 📊 Composant DashboardStats - Métriques Universelles Phase 5B
 * 
 * Ce composant illustre un principe architectural fondamental : la réutilisabilité
 * intelligente. Au lieu de créer des composants séparés pour chaque type de dashboard,
 * nous créons un composant unique capable de s'adapter selon le contexte.
 * 
 * 🎯 Concept pédagogique : "Adaptive Component Design"
 * Pensez à ce composant comme un caméléon qui change d'apparence selon son environnement.
 * Il garde la même structure interne (logique de rendu des stats) mais adapte sa
 * présentation (couleurs, icônes, formatage) selon le type d'utilisateur.
 * 
 * 🏗️ Architecture de données :
 * Chaque stat suit une structure standardisée :
 * - title: Le nom de la métrique
 * - value: La valeur actuelle
 * - change: L'évolution ou contexte additionnel
 * - trend: Direction de l'évolution (up/down/neutral)
 * - icon: Représentation visuelle
 * - description: Contexte explicatif
 * 
 * Cette standardisation permet une cohérence visuelle tout en offrant
 * la flexibilité nécessaire pour des domaines métier différents.
 */
function DashboardStats({ title = "Statistics", stats = [], type = "default" }) {
  
  /**
   * 🎨 Configuration des thèmes visuels par type d'utilisateur
   * 
   * Cette approche centralise la gestion visuelle et facilite la maintenance.
   * Chaque type d'utilisateur a sa propre identité visuelle qui renforce
   * l'expérience utilisateur et aide à la navigation mentale.
   */
  const themeConfig = useMemo(() => {
    const themes = {
      player: {
        primaryColor: 'blue',
        accentColor: 'blue-light',
        cardClass: 'stats-card--player',
        iconStyle: 'icon--player'
      },
      coach: {
        primaryColor: 'green',
        accentColor: 'green-light',
        cardClass: 'stats-card--coach',
        iconStyle: 'icon--coach'
      },
      'njcaa-coach': {
        primaryColor: 'purple',
        accentColor: 'purple-light',
        cardClass: 'stats-card--njcaa-coach',
        iconStyle: 'icon--njcaa-coach'
      },
      admin: {
        primaryColor: 'red',
        accentColor: 'red-light',
        cardClass: 'stats-card--admin',
        iconStyle: 'icon--admin'
      },
      default: {
        primaryColor: 'gray',
        accentColor: 'gray-light',
        cardClass: 'stats-card--default',
        iconStyle: 'icon--default'
      }
    }
    
    return themes[type] || themes.default
  }, [type])

  /**
   * 🎯 Fonction de formatage intelligent des valeurs
   * 
   * Cette fonction adapte l'affichage des valeurs selon leur type et leur magnitude.
   * Elle améliore la lisibilité et la compréhension des données numériques.
   */
  const formatStatValue = (value) => {
    // Si c'est déjà une chaîne formatée, la retourner telle quelle
    if (typeof value === 'string') return value
    
    // Si c'est un nombre, appliquer un formatage intelligent
    if (typeof value === 'number') {
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`
      }
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`
      }
      return value.toString()
    }
    
    return value
  }

  /**
   * 🎨 Génération de la classe CSS pour l'indicateur de tendance
   * 
   * Cette fonction traduit les données de tendance en classes CSS appropriées
   * pour un feedback visuel immédiat et intuitif.
   */
  const getTrendClass = (trend) => {
    const trendClasses = {
      up: 'trend-indicator--positive',
      down: 'trend-indicator--negative',
      neutral: 'trend-indicator--neutral'
    }
    
    return trendClasses[trend] || trendClasses.neutral
  }

  /**
   * 🎯 Génération de l'icône de tendance
   * 
   * Représentation visuelle claire de l'évolution des métriques
   * pour une compréhension instantanée des performances.
   */
  const getTrendIcon = (trend) => {
    const trendIcons = {
      up: '↗️',
      down: '↘️',
      neutral: '➡️'
    }
    
    return trendIcons[trend] || trendIcons.neutral
  }

  /**
   * 📱 Gestion du cas où aucune statistique n'est fournie
   * 
   * Interface de fallback élégante qui maintient la cohérence visuelle
   * même en l'absence de données.
   */
  if (!stats || stats.length === 0) {
    return (
      <div className={`dashboard-stats ${themeConfig.cardClass}`}>
        <div className="dashboard-stats__header">
          <h3 className="dashboard-stats__title">{title}</h3>
        </div>
        <div className="dashboard-stats__empty">
          <div className="empty-state">
            <span className="empty-state__icon">📊</span>
            <p className="empty-state__message">No statistics available yet</p>
            <small className="empty-state__hint">Data will appear here once available</small>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`dashboard-stats ${themeConfig.cardClass}`}>
      {/* 📋 En-tête de la section statistiques */}
      <div className="dashboard-stats__header">
        <h3 className="dashboard-stats__title">{title}</h3>
        <span className="dashboard-stats__count">
          {stats.length} metric{stats.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* 📊 Grille des cartes de statistiques */}
      <div className="dashboard-stats__grid">
        {stats.map((stat, index) => (
          <div 
            key={`stat-${index}`} 
            className={`stat-card ${stat.urgent ? 'stat-card--urgent' : ''}`}
          >
            {/* 🎨 En-tête de la carte avec icône et titre */}
            <div className="stat-card__header">
              <div className="stat-card__icon-wrapper">
                <span className={`stat-card__icon ${themeConfig.iconStyle}`}>
                  {stat.icon}
                </span>
              </div>
              <div className="stat-card__title-section">
                <h4 className="stat-card__title">{stat.title}</h4>
                <p className="stat-card__description">{stat.description}</p>
              </div>
            </div>

            {/* 📈 Valeur principale et indicateur de tendance */}
            <div className="stat-card__content">
              <div className="stat-card__value-section">
                <span className="stat-card__value">
                  {formatStatValue(stat.value)}
                </span>
                {stat.change && (
                  <div className={`stat-card__change ${getTrendClass(stat.trend)}`}>
                    <span className="trend-icon">
                      {getTrendIcon(stat.trend)}
                    </span>
                    <span className="trend-text">
                      {stat.change}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 🚨 Indicateur d'urgence pour les métriques critiques */}
            {stat.urgent && (
              <div className="stat-card__urgent-indicator">
                <span className="urgent-badge">
                  ⚠️ Requires Attention
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 📝 Note explicative pour l'interprétation des données */}
      <div className="dashboard-stats__footer">
        <p className="dashboard-stats__note">
          📈 Statistics update in real-time based on platform activity
        </p>
      </div>
    </div>
  )
}

export default DashboardStats