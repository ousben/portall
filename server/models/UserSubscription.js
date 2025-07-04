// portall/server/models/UserSubscription.js

'use strict';

/**
 * Modèle UserSubscription - La liaison entre un utilisateur et son abonnement
 * 
 * Ce modèle représente l'abonnement actuel d'un utilisateur. C'est le "contrat"
 * entre l'utilisateur et Portall. Chaque utilisateur ne peut avoir qu'un seul
 * abonnement actif à la fois.
 * 
 * Analogie : Si SubscriptionPlan est le "menu du restaurant", UserSubscription
 * est la "commande passée" par un client spécifique.
 * 
 * États d'abonnement importants à comprendre :
 * - ACTIVE : L'utilisateur paye et a accès à toutes les fonctionnalités
 * - PENDING : Abonnement créé mais paiement pas encore confirmé
 * - CANCELLED : L'utilisateur a annulé mais garde l'accès jusqu'à la fin de période
 * - EXPIRED : L'abonnement est terminé, accès restreint
 * - SUSPENDED : Problème de paiement, accès suspendu temporairement
 */

module.exports = (sequelize, DataTypes) => {
  const UserSubscription = sequelize.define('UserSubscription', {
    // Référence vers l'utilisateur propriétaire
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'Utilisateur propriétaire de cet abonnement'
    },
    
    // Référence vers le plan choisi
    plan_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'subscription_plans',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT', // Empêche la suppression d'un plan ayant des abonnements
      comment: 'Plan d\'abonnement souscrit'
    },
    
    // Statut de l'abonnement
    status: {
      type: DataTypes.ENUM(
        'active',     // Abonnement actif et à jour
        'pending',    // En attente de confirmation de paiement
        'cancelled',  // Annulé mais actif jusqu'à la fin de période
        'expired',    // Expiré, accès restreint
        'suspended'   // Suspendu pour problème de paiement
      ),
      allowNull: false,
      defaultValue: 'pending',
      comment: 'Statut actuel de l\'abonnement'
    },
    
    // ID de l'abonnement chez Stripe
    stripe_subscription_id: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      validate: {
        isValidStripeId(value) {
          if (value && !value.startsWith('sub_')) {
            throw new Error('stripeSubscriptionId doit commencer par "sub_"');
          }
        }
      },
      comment: 'ID de l\'abonnement correspondant chez Stripe'
    },
    
    // ID du client chez Stripe
    stripe_customer_id: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isValidStripeId(value) {
          if (value && !value.startsWith('cus_')) {
            throw new Error('stripeCustomerId doit commencer par "cus_"');
          }
        }
      },
      comment: 'ID du client correspondant chez Stripe'
    },
    
    // Date de début de l'abonnement
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date de début effectif de l\'abonnement'
    },
    
    // Date de fin de l'abonnement (fin de période payée)
    ends_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date de fin de la période payée actuelle'
    },
    
    // Date d'annulation (si applicable)
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date d\'annulation de l\'abonnement'
    },
    
    // Métadonnées additionnelles (JSON flexible)
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment: 'Données additionnelles flexibles'
    }
  }, {
    tableName: 'user_subscriptions',
    timestamps: true,
    underscored: true,
    
    // Index pour optimiser les requêtes
    indexes: [
      {
        fields: ['user_id'],
        unique: true // Un utilisateur = un abonnement maximum
      },
      {
        fields: ['status']
      },
      {
        fields: ['stripe_subscription_id'],
        unique: true,
        where: {
          stripe_subscription_id: {
            [sequelize.Sequelize.Op.ne]: null
          }
        }
      },
      {
        fields: ['ends_at']
      }
    ]
  });

  /**
   * Méthodes d'instance
   */
  
  // Vérifier si l'abonnement est actif
  UserSubscription.prototype.isActive = function() {
    return this.status === 'active' && 
           (!this.ends_at || new Date() < this.ends_at);
  };
  
  // Vérifier si l'abonnement expire bientôt (dans les 7 jours)
  UserSubscription.prototype.isExpiringSoon = function() {
    if (!this.ends_at) return false;
    
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    return this.ends_at <= sevenDaysFromNow;
  };
  
  // Obtenir le nombre de jours restants
  UserSubscription.prototype.getDaysRemaining = function() {
    if (!this.ends_at) return null;
    
    const now = new Date();
    const diffTime = this.ends_at - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  };
  
  // Marquer comme annulé
  UserSubscription.prototype.cancel = async function() {
    this.status = 'cancelled';
    this.cancelled_at = new Date();
    await this.save();
  };
  
  // Activer l'abonnement après paiement confirmé
  UserSubscription.prototype.activate = async function(endsAt = null) {
    this.status = 'active';
    this.started_at = this.started_at || new Date();
    
    if (endsAt) {
      this.ends_at = endsAt;
    }
    
    await this.save();
  };

  /**
   * Méthodes de classe (static)
   */
  
  // Trouver l'abonnement actif d'un utilisateur
  UserSubscription.findActiveForUser = function(userId) {
    return this.findOne({
      where: {
        user_id: userId,
        status: 'active'
      },
      include: [{
        model: this.sequelize.models.SubscriptionPlan,
        as: 'plan'
      }]
    });
  };
  
  // Trouver les abonnements expirant bientôt
  UserSubscription.findExpiringSoon = function() {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    return this.findAll({
      where: {
        status: 'active',
        ends_at: {
          [sequelize.Sequelize.Op.lte]: sevenDaysFromNow,
          [sequelize.Sequelize.Op.gte]: new Date()
        }
      },
      include: [{
        model: this.sequelize.models.User,
        as: 'user'
      }]
    });
  };

  // Associations
  UserSubscription.associate = function(models) {
    // Appartient à un utilisateur
    UserSubscription.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
    
    // Appartient à un plan
    UserSubscription.belongsTo(models.SubscriptionPlan, {
      foreignKey: 'plan_id',
      as: 'plan'
    });
    
    // A plusieurs paiements
    UserSubscription.hasMany(models.PaymentHistory, {
      foreignKey: 'subscription_id',
      as: 'payments'
    });
  };

  return UserSubscription;
};