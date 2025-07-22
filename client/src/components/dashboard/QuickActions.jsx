// portall/client/src/components/dashboard/QuickActions.jsx
import { useMemo } from 'react'

/**
 * ⚡ Composant QuickActions - Actions Contextuelles Phase 5B
 * 
 * Ce composant incarne le principe de "Progressive Disclosure" en interface utilisateur.
 * Au lieu de submerger l'utilisateur avec toutes les options possibles, nous présentons
 * les actions les plus pertinentes selon son rôle et son contexte actuel.
 * 
 * 🎯 Concept pédagogique : "Context-Aware Interface"
 * Imaginez ce composant comme un assistant personnel intelligent qui anticipe
 * vos besoins selon votre rôle. Un joueur verra des actions liées à son profil,
 * un coach verra des actions de recrutement, un admin verra des actions de gestion.
 * 
 * 🏗️ Architecture des priorités :
 * - Primary: Actions critiques et fréquentes (boutons prominents)
 * - Secondary: Actions importantes mais moins fréquentes (boutons normaux)
 * - Tertiary: Actions utiles mais occasionnelles (boutons discrets)
 * 
 * Cette hiérarchisation guide l'attention de l'utilisateur vers les actions
 * les plus importantes pour sa productivité et ses objectifs métier.
 */
function QuickActions({ title = "Quick Actions", actions = [], type = "default" }) {

  /**
   * 🎨 Configuration des thèmes visuels et comportementaux
   * 
   * Chaque type d'utilisateur a des besoins et des patterns d'usage différents.
   * Cette configuration adapte l'apparence et l'organisation des actions
   * pour optimiser l'efficacité de chaque groupe d'utilisateurs.
   */
  const themeConfig = useMemo(() => {
    const themes = {
      player: {
        containerClass: 'quick-actions--player',
        primaryButtonClass: 'btn--primary-blue',
        accentColor: 'blue',
        maxVisiblePrimary: 2,
        gridColumns: 'repeat(auto-fit, minmax(280px, 1fr))'
      },
      coach: {
        containerClass: 'quick-actions--coach',
        primaryButtonClass: 'btn--primary-green',
        accentColor: 'green',
        maxVisiblePrimary: 3,
        gridColumns: 'repeat(auto-fit, minmax(260px, 1fr))'
      },
      'njcaa-coach': {
        containerClass: 'quick-actions--njcaa-coach',
        primaryButtonClass: 'btn--primary-purple',
        accentColor: 'purple',
        maxVisiblePrimary: 2,
        gridColumns: 'repeat(auto-fit, minmax(280px, 1fr))'
      },
      admin: {
        containerClass: 'quick-actions--admin',
        primaryButtonClass: 'btn--primary-red',
        accentColor: 'red',
        maxVisiblePrimary: 4,
        gridColumns: 'repeat(auto-fit, minmax(240px, 1fr))'
      },
      default: {
        containerClass: 'quick-actions--default',
        primaryButtonClass: 'btn--primary',
        accentColor: 'gray',
        maxVisiblePrimary: 3,
        gridColumns: 'repeat(auto-fit, minmax(260px, 1fr))'
      }
    }
    
    return themes[type] || themes.default
  }, [type])

  /**
   * 📊 Organisation intelligente des actions par priorité
   * 
   * Cette fonction trie et organise les actions selon leur priorité,
   * garantissant que les actions les plus importantes sont toujours visibles
   * et facilement accessibles.
   */
  const organizedActions = useMemo(() => {
    const priorityOrder = { primary: 1, secondary: 2, tertiary: 3 }
    
    return actions
      .filter(action => action && typeof action.action === 'function')
      .sort((a, b) => {
        const priorityA = priorityOrder[a.priority] || 3
        const priorityB = priorityOrder[b.priority] || 3
        return priorityA - priorityB
      })
  }, [actions])

  /**
   * 🎯 Génération de la classe CSS pour le bouton d'action
   * 
   * Cette fonction applique le bon style selon la priorité de l'action
   * et le thème de l'utilisateur, créant une hiérarchie visuelle claire.
   */
  const getActionButtonClass = (priority) => {
    const baseClass = 'action-card__button'
    
    switch (priority) {
      case 'primary':
        return `${baseClass} ${themeConfig.primaryButtonClass}`
      case 'secondary':
        return `${baseClass} btn--secondary`
      case 'tertiary':
        return `${baseClass} btn--tertiary`
      default:
        return `${baseClass} btn--outline`
    }
  }

  /**
   * 🏷️ Génération du badge de priorité
   * 
   * Indicateur visuel optionnel pour les actions qui nécessitent
   * une attention particulière (comme les notifications de nombre).
   */
  const renderActionBadge = (action) => {
    if (!action.badge) return null
    
    return (
      <span className="action-card__badge">
        {action.badge}
      </span>
    )
  }

  /**
   * 🎨 Génération de l'icône d'action avec fallback
   * 
   * Assure qu'il y a toujours une représentation visuelle,
   * même si l'icône spécifique n'est pas fournie.
   */
  const renderActionIcon = (icon, priority) => {
    const defaultIcons = {
      primary: '⚡',
      secondary: '🔧',
      tertiary: '📎'
    }
    
    return (
      <span className="action-card__icon">
        {icon || defaultIcons[priority] || '📎'}
      </span>
    )
  }

  /**
   * 📱 Gestion du cas où aucune action n'est disponible
   * 
   * Interface de fallback qui encourage l'utilisateur à explorer
   * d'autres sections de l'application.
   */
  if (!organizedActions || organizedActions.length === 0) {
    return (
      <div className={`quick-actions ${themeConfig.containerClass}`}>
        <div className="quick-actions__header">
          <h3 className="quick-actions__title">{title}</h3>
        </div>
        <div className="quick-actions__empty">
          <div className="empty-state">
            <span className="empty-state__icon">⚡</span>
            <p className="empty-state__message">No quick actions available</p>
            <small className="empty-state__hint">Actions will appear here based on your activity</small>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`quick-actions ${themeConfig.containerClass}`}>
      {/* 📋 En-tête de la section avec compteur d'actions */}
      <div className="quick-actions__header">
        <h3 className="quick-actions__title">{title}</h3>
        <span className="quick-actions__count">
          {organizedActions.length} action{organizedActions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ⚡ Grille des cartes d'actions */}
      <div 
        className="quick-actions__grid"
        style={{ gridTemplateColumns: themeConfig.gridColumns }}
      >
        {organizedActions.map((action, index) => (
          <div 
            key={`action-${index}`}
            className={`action-card action-card--${action.priority}`}
          >
            {/* 🎨 En-tête de la carte avec icône et badge */}
            <div className="action-card__header">
              <div className="action-card__icon-wrapper">
                {renderActionIcon(action.icon, action.priority)}
                {renderActionBadge(action)}
              </div>
              <div className="action-card__title-section">
                <h4 className="action-card__title">{action.title}</h4>
                <p className="action-card__description">{action.description}</p>
              </div>
            </div>

            {/* 🎯 Section d'action avec bouton principal */}
            <div className="action-card__content">
              <button
                onClick={action.action}
                className={getActionButtonClass(action.priority)}
                aria-label={`${action.title}: ${action.description}`}
              >
                <span className="button-text">{action.title}</span>
                {action.priority === 'primary' && (
                  <span className="button-arrow">→</span>
                )}
              </button>
            </div>

            {/* 🏷️ Indicateur de priorité pour l'accessibilité */}
            <div className="action-card__priority-indicator">
              <span className={`priority-dot priority-dot--${action.priority}`}></span>
            </div>
          </div>
        ))}
      </div>

      {/* 📝 Note explicative sur l'utilisation des actions */}
      <div className="quick-actions__footer">
        <p className="quick-actions__note">
          💡 Actions are organized by importance and frequency of use
        </p>
      </div>
    </div>
  )
}

export default QuickActions