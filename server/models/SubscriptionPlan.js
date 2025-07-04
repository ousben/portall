// portall/server/models/SubscriptionPlan.js

'use strict';

/**
 * Modèle SubscriptionPlan simplifié pour Portall
 * 
 * Architecture simplifiée selon les spécifications :
 * - Pas d'essai gratuit (trialPeriodDays toujours null)
 * - Seulement 2 plans : mensuel (29.99 USD) et annuel (79.99 USD)
 * - Mêmes plans pour tous les utilisateurs (coachs et joueurs)
 * 
 * Cette simplicité facilite :
 * 1. La maintenance du code
 * 2. L'expérience utilisateur (moins de choix = moins de confusion)
 * 3. Les tests et la validation
 * 4. L'évolution future (on peut toujours complexifier plus tard)
 */

module.exports = (sequelize, DataTypes) => {
  const SubscriptionPlan = sequelize.define('SubscriptionPlan', {
    // Nom du plan (ex: "Plan Mensuel", "Plan Annuel")
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 100]
      },
      comment: 'Nom public du plan affiché à l\'utilisateur'
    },
    
    // Description marketing du plan
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Description des avantages du plan'
    },
    
    // Prix en centimes (convention Stripe pour éviter les erreurs de calcul)
    // 29.99 USD = 2999 centimes, 79.99 USD = 7999 centimes
    price_in_cents: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
        isInt: true,
        isValidPrice(value) {
          // Validation que le prix correspond à nos plans autorisés
          const validPrices = [2999, 7999]; // 29.99 et 79.99 en centimes
          if (!validPrices.includes(value)) {
            throw new Error('Prix doit être 2999 (29.99 USD) ou 7999 (79.99 USD)');
          }
        }
      },
      comment: 'Prix en centimes selon la convention Stripe'
    },
    
    // Devise fixée à USD pour le marché américain
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'USD',
      validate: {
        isIn: [['USD']], // Simplifié pour le marché US uniquement
        len: [3, 3]
      },
      comment: 'Devise ISO 4217 - USD uniquement pour Portall'
    },
    
    // Intervalle de facturation simplifié
    billing_interval: {
      type: DataTypes.ENUM('month', 'year'),
      allowNull: false,
      validate: {
        isIn: [['month', 'year']],
        isValidInterval(value) {
          // Validation métier : cohérence prix/intervalle
          const monthlyPrice = 2999; // 29.99 USD
          const yearlyPrice = 7999;  // 79.99 USD
          
          if (value === 'month' && this.price_in_cents !== monthlyPrice) {
            throw new Error('Plan mensuel doit coûter 29.99 USD');
          }
          if (value === 'year' && this.price_in_cents !== yearlyPrice) {
            throw new Error('Plan annuel doit coûter 79.99 USD');
          }
        }
      },
      comment: 'Fréquence de facturation : month ou year uniquement'
    },
    
    // Types d'utilisateurs autorisés (tous dans votre cas)
    allowed_user_types: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: ['coach', 'player'],
      validate: {
        isValidUserTypes(value) {
          const validTypes = ['coach', 'player'];
          const isValid = Array.isArray(value) && 
                         value.every(type => validTypes.includes(type)) &&
                         value.length === 2; // Doit inclure les deux types
          if (!isValid) {
            throw new Error('allowedUserTypes doit inclure coach et player');
          }
        }
      },
      comment: 'Types d\'utilisateurs autorisés - coach et player pour tous les plans'
    },
    
    // Fonctionnalités incluses (identiques pour tous les plans dans votre cas)
    features: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {
        profileAccess: true,
        searchAccess: true,
        contactCoaches: true,
        viewPlayerProfiles: true,
        favoriteProfiles: true,
        analyticsBasic: true
      },
      comment: 'Fonctionnalités incluses - identiques pour tous les plans'
    },
    
    // ID du prix chez Stripe (rempli après synchronisation)
    stripe_price_id: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      validate: {
        isValidStripeId(value) {
          if (value && !value.startsWith('price_')) {
            throw new Error('stripePriceId doit commencer par "price_"');
          }
        }
      },
      comment: 'ID du prix correspondant chez Stripe'
    },
    
    // Plan actif ou archivé
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Plan disponible pour de nouveaux abonnements'
    },
    
    // Position pour l'affichage (mensuel en premier, puis annuel)
    display_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        isValidOrder(value) {
          // Mensuel = ordre 1, Annuel = ordre 2
          if (this.billing_interval === 'month' && value !== 1) {
            throw new Error('Plan mensuel doit avoir display_order = 1');
          }
          if (this.billing_interval === 'year' && value !== 2) {
            throw new Error('Plan annuel doit avoir display_order = 2');
          }
        }
      },
      comment: 'Ordre d\'affichage : 1 pour mensuel, 2 pour annuel'
    }
  }, {
    tableName: 'subscription_plans',
    timestamps: true,
    underscored: true,
    
    // Index optimisés pour vos cas d'usage
    indexes: [
      {
        fields: ['is_active']
      },
      {
        fields: ['billing_interval']
      },
      {
        fields: ['display_order']
      },
      {
        fields: ['stripe_price_id'],
        unique: true,
        where: {
          stripe_price_id: {
            [sequelize.Sequelize.Op.ne]: null
          }
        }
      }
    ]
  });

  /**
   * Méthodes d'instance simplifiées
   */
  
  // Formater le prix pour l'affichage
  SubscriptionPlan.prototype.getFormattedPrice = function() {
    const price = (this.price_in_cents / 100).toFixed(2);
    return `$${price}`;
  };
  
  // Calculer l'économie du plan annuel vs mensuel
  SubscriptionPlan.prototype.getYearlySavings = function() {
    if (this.billing_interval !== 'year') return null;
    
    const yearlyPrice = this.price_in_cents / 100;
    const monthlyPrice = 29.99;
    const monthlyYearlyEquivalent = monthlyPrice * 12;
    const savings = monthlyYearlyEquivalent - yearlyPrice;
    
    return {
      savingsAmount: savings,
      savingsPercentage: Math.round((savings / monthlyYearlyEquivalent) * 100),
      formattedSavings: `$${savings.toFixed(2)}`
    };
  };
  
  // Obtenir les informations d'affichage complètes
  SubscriptionPlan.prototype.getDisplayInfo = function() {
    const baseInfo = {
      id: this.id,
      name: this.name,
      description: this.description,
      price: this.getFormattedPrice(),
      interval: this.billing_interval,
      intervalDisplay: this.billing_interval === 'month' ? 'par mois' : 'par an',
      features: this.features
    };

    // Ajouter les économies pour le plan annuel
    if (this.billing_interval === 'year') {
      const savings = this.getYearlySavings();
      baseInfo.savings = savings;
      baseInfo.popularBadge = 'Plus populaire - Économisez ' + savings.formattedSavings;
    }

    return baseInfo;
  };

  /**
   * Méthodes de classe (static) simplifiées
   */
  
  // Obtenir tous les plans actifs (dans l'ordre d'affichage)
  SubscriptionPlan.findAllActive = function() {
    return this.findAll({
      where: {
        is_active: true
      },
      order: [['display_order', 'ASC']]
    });
  };

  // Obtenir un plan par intervalle de facturation
  SubscriptionPlan.findByInterval = function(interval) {
    return this.findOne({
      where: {
        billing_interval: interval,
        is_active: true
      }
    });
  };

  // Associations avec les autres modèles
  SubscriptionPlan.associate = function(models) {
    // Un plan peut avoir plusieurs abonnements utilisateurs
    SubscriptionPlan.hasMany(models.UserSubscription, {
      foreignKey: 'plan_id',
      as: 'subscriptions'
    });
  };

  return SubscriptionPlan;
};