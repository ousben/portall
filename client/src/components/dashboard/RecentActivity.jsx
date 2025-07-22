// portall/client/src/components/dashboard/RecentActivity.jsx
import { useMemo } from 'react'

/**
 * 📈 Composant RecentActivity - Flux d'Activité Contextuel Phase 5B
 * 
 * Ce composant illustre le concept de "Contextual Information Architecture".
 * L'activité récente n'a pas la même signification pour tous les utilisateurs :
 * - Pour un joueur : qui a vu son profil, nouveaux intérêts de coachs
 * - Pour un coach : recherches effectuées, joueurs consultés, favoris ajoutés
 * - Pour un admin : approbations traitées, problèmes résolus, activité système
 * 
 * 🎯 Concept pédagogique : "Narrative Dashboard Design"
 * Pensez à ce composant comme un "journal de bord" intelligent qui raconte
 * l'histoire de l'activité de l'utilisateur dans un langage et un contexte
 * qui lui sont pertinents et utiles.
 * 
 * 🏗️ Structure des données d'activité :
 * Chaque activité suit un format standardisé mais flexible :
 * - type: Catégorie de l'activité (view, interaction, system, etc.)
 * - title: Description principale de l'activité
 * - description: Détails additionnels
 * - timestamp: Moment de l'activité
 * - metadata: Données contextuelles spécifiques
 * - priority: Importance relative de l'activité
 * 
 * Cette structure permet une présentation cohérente tout en gardant
 * la flexibilité nécessaire pour différents types d'événements.
 */
function RecentActivity({ title = "Recent Activity", activities = [], type = "default" }) {

  /**
   * 🎨 Configuration des thèmes et des patterns d'activité
   * 
   * Chaque type d'utilisateur a des patterns d'activité différents qui
   * nécessitent des présentations et des priorités visuelles adaptées.
   */
  const activityConfig = useMemo(() => {
    const configs = {
      player: {
        containerClass: 'recent-activity--player',
        emptyMessage: 'No recent activity on your profile',
        emptyHint: 'Activity will appear when coaches view your profile or show interest',
        maxVisible: 8,
        showTimestamp: true,
        groupByDay: true
      },
      coach: {
        containerClass: 'recent-activity--coach',
        emptyMessage: 'No recent recruitment activity',
        emptyHint: 'Activity will appear when you search for players or interact with profiles',
        maxVisible: 10,
        showTimestamp: true,
        groupByDay: false
      },
      'njcaa-coach': {
        containerClass: 'recent-activity--njcaa-coach',
        emptyMessage: 'No recent team management activity',
        emptyHint: 'Activity will appear when you evaluate players or update team information',
        maxVisible: 8,
        showTimestamp: true,
        groupByDay: false
      },
      admin: {
        containerClass: 'recent-activity--admin',
        emptyMessage: 'No recent administrative activity',
        emptyHint: 'Activity will appear when you process approvals or manage the platform',
        maxVisible: 15,
        showTimestamp: true,
        groupByDay: true
      },
      default: {
        containerClass: 'recent-activity--default',
        emptyMessage: 'No recent activity',
        emptyHint: 'Activity will appear here based on your interactions',
        maxVisible: 10,
        showTimestamp: true,
        groupByDay: false
      }
    }
    
    return configs[type] || configs.default
  }, [type])

  /**
   * 🎯 Mappage des types d'activité vers des icônes et styles
   * 
   * Cette fonction traduit les types d'activité abstraits en représentations
   * visuelles concrètes qui aident l'utilisateur à comprendre rapidement
   * la nature de chaque événement.
   */
  const getActivityIcon = (activityType) => {
    const iconMap = {
      // Activités communes
      'profile_view': '👁️',
      'profile_update': '✏️',
      'login': '🔐',
      'logout': '🚪',
      
      // Activités spécifiques aux joueurs
      'coach_interest': '⭐',
      'profile_favorite': '❤️',
      'message_received': '💌',
      'evaluation_received': '📊',
      
      // Activités spécifiques aux coachs
      'player_search': '🔍',
      'player_view': '👀',
      'favorite_added': '⭐',
      'favorite_removed': '💔',
      'contact_sent': '📩',
      'evaluation_completed': '✅',
      
      // Activités spécifiques aux coachs NJCAA
      'player_evaluated': '📝',
      'roster_updated': '👥',
      'team_stats_updated': '📈',
      'player_promoted': '🎯',
      
      // Activités administratives
      'user_approved': '✅',
      'user_rejected': '❌',
      'system_maintenance': '🔧',
      'security_alert': '🚨',
      'data_export': '📥',
      
      // Fallback
      'default': '📎'
    }
    
    return iconMap[activityType] || iconMap.default
  }

  /**
   * 🕐 Formatage intelligent des timestamps
   * 
   * Cette fonction présente les timestamps de manière contextuelle et lisible,
   * adaptant le niveau de détail selon l'ancienneté de l'activité.
   */
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown time'
    
    const now = new Date()
    const activityDate = new Date(timestamp)
    const diffMs = now - activityDate
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    // Temps récent (moins d'une heure)
    if (diffMinutes < 60) {
      if (diffMinutes < 1) return 'Just now'
      if (diffMinutes === 1) return '1 minute ago'
      return `${diffMinutes} minutes ago`
    }
    
    // Aujourd'hui
    if (diffHours < 24 && activityDate.toDateString() === now.toDateString()) {
      if (diffHours === 1) return '1 hour ago'
      return `${diffHours} hours ago`
    }
    
    // Cette semaine
    if (diffDays < 7) {
      if (diffDays === 1) return 'Yesterday'
      return `${diffDays} days ago`
    }
    
    // Plus ancien
    return activityDate.toLocaleDateString()
  }

  /**
   * 🎨 Génération de la classe CSS pour le type d'activité
   * 
   * Cette fonction assigne des styles visuels selon l'importance et le type
   * de l'activité, créant une hiérarchie visuelle claire.
   */
  const getActivityItemClass = (activity) => {
    const baseClass = 'activity-item'
    const typeClass = `activity-item--${activity.type?.replace('_', '-')}`
    const priorityClass = activity.priority ? `activity-item--${activity.priority}` : ''
    
    return [baseClass, typeClass, priorityClass].filter(Boolean).join(' ')
  }

  /**
   * 📊 Tri et filtrage intelligent des activités
   * 
   * Cette fonction organise les activités par pertinence et fraîcheur,
   * en respectant les limites de visibilité configurées pour chaque type d'utilisateur.
   */
  const processedActivities = useMemo(() => {
    if (!activities || activities.length === 0) return []
    
    return activities
      .filter(activity => activity && activity.title) // Valider les données
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Trier par date décroissante
      .slice(0, activityConfig.maxVisible) // Limiter le nombre d'éléments
  }, [activities, activityConfig.maxVisible])

  /**
   * 📱 Interface vide avec encouragement à l'action
   * 
   * Cette interface de fallback ne se contente pas d'informer de l'absence d'activité,
   * elle guide l'utilisateur vers des actions qui génèreront de l'activité future.
   */
  if (processedActivities.length === 0) {
    return (
      <div className={`recent-activity ${activityConfig.containerClass}`}>
        <div className="recent-activity__header">
          <h3 className="recent-activity__title">{title}</h3>
        </div>
        <div className="recent-activity__empty">
          <div className="empty-state">
            <span className="empty-state__icon">📈</span>
            <p className="empty-state__message">{activityConfig.emptyMessage}</p>
            <small className="empty-state__hint">{activityConfig.emptyHint}</small>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`recent-activity ${activityConfig.containerClass}`}>
      {/* 📋 En-tête avec compteur d'activités */}
      <div className="recent-activity__header">
        <h3 className="recent-activity__title">{title}</h3>
        <div className="recent-activity__meta">
          <span className="activity-count">
            {processedActivities.length} recent item{processedActivities.length !== 1 ? 's' : ''}
          </span>
          {activities.length > activityConfig.maxVisible && (
            <span className="activity-overflow">
              +{activities.length - activityConfig.maxVisible} more
            </span>
          )}
        </div>
      </div>

      {/* 📈 Liste des activités récentes */}
      <div className="recent-activity__list">
        {processedActivities.map((activity, index) => (
          <div 
            key={`activity-${index}`}
            className={getActivityItemClass(activity)}
          >
            {/* 🎨 Section icône et contenu principal */}
            <div className="activity-item__content">
              <div className="activity-item__icon-wrapper">
                <span className="activity-item__icon">
                  {getActivityIcon(activity.type)}
                </span>
              </div>
              
              <div className="activity-item__details">
                <div className="activity-item__main">
                  <h4 className="activity-item__title">{activity.title}</h4>
                  {activity.description && (
                    <p className="activity-item__description">{activity.description}</p>
                  )}
                </div>
                
                {/* 🕐 Timestamp et métadonnées */}
                <div className="activity-item__metadata">
                  {activityConfig.showTimestamp && (
                    <span className="activity-item__timestamp">
                      {formatTimestamp(activity.timestamp)}
                    </span>
                  )}
                  
                  {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                    <div className="activity-item__extra-info">
                      {Object.entries(activity.metadata).map(([key, value], metaIndex) => (
                        <span 
                          key={`meta-${metaIndex}`}
                          className="metadata-item"
                        >
                          {value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 🎯 Indicateur de priorité si applicable */}
            {activity.priority && activity.priority !== 'normal' && (
              <div className="activity-item__priority-indicator">
                <span className={`priority-dot priority-dot--${activity.priority}`}></span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 📝 Pied de page avec actions additionnelles */}
      <div className="recent-activity__footer">
        <p className="recent-activity__note">
          🔄 Activity updates in real-time
        </p>
        {activities.length > activityConfig.maxVisible && (
          <button className="btn btn--sm btn--outline view-all-button">
            View All Activity ({activities.length} total)
          </button>
        )}
      </div>
    </div>
  )
}

export default RecentActivity