// portall/server/models/PaymentHistory.js

'use strict';

/**
 * Modèle PaymentHistory - L'historique complet des transactions financières
 * 
 * Ce modèle est votre "livre de comptes" numérique. Chaque transaction,
 * qu'elle soit réussie ou échouée, y est enregistrée de manière permanente.
 * 
 * Analogie comptable : Si UserSubscription représente votre "contrat client",
 * PaymentHistory représente chaque "écriture comptable" liée à ce contrat.
 * 
 * Pourquoi c'est crucial pour votre business :
 * 1. Traçabilité financière complète (audits, comptabilité)
 * 2. Résolution des litiges clients
 * 3. Analyse des échecs de paiement (optimisation du taux de conversion)
 * 4. Conformité réglementaire (conservation des preuves de transaction)
 * 5. Calculs de revenus et analytics business
 * 
 * Concept important : IMMUTABILITÉ
 * Une fois créé, un enregistrement PaymentHistory ne doit JAMAIS être modifié.
 * Si une correction est nécessaire, on crée un nouvel enregistrement.
 * C'est un principe fondamental de la comptabilité : on ne gomme jamais,
 * on ajoute une ligne de correction.
 */

module.exports = (sequelize, DataTypes) => {
  const PaymentHistory = sequelize.define('PaymentHistory', {
    // Référence vers l'abonnement concerné
    subscription_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'user_subscriptions',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE', // Si l'abonnement est supprimé, garder l'historique pour audit
      comment: 'Abonnement auquel se rattache ce paiement'
    },
    
    // ID du PaymentIntent chez Stripe
    stripe_payment_intent_id: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      validate: {
        isValidStripeId(value) {
          if (value && !value.startsWith('pi_')) {
            throw new Error('stripe_payment_intent_id doit commencer par "pi_"');
          }
        }
      },
      comment: 'ID du PaymentIntent Stripe - unique pour chaque tentative de paiement'
    },
    
    // ID de la facture chez Stripe (pour les abonnements récurrents)
    stripe_invoice_id: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isValidStripeId(value) {
          if (value && !value.startsWith('in_')) {
            throw new Error('stripe_invoice_id doit commencer par "in_"');
          }
        }
      },
      comment: 'ID de la facture Stripe pour les paiements récurrents'
    },
    
    // Montant exact payé (en centimes pour précision)
    amount_in_cents: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
        isInt: true,
        isValidAmount(value) {
          // Validation que le montant correspond aux tarifs Portall
          const validAmounts = [2999, 7999]; // 29.99 et 79.99 USD
          if (!validAmounts.includes(value)) {
            throw new Error('Montant doit correspondre aux tarifs Portall (2999 ou 7999 centimes)');
          }
        }
      },
      comment: 'Montant exact facturé en centimes'
    },
    
    // Devise de la transaction
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'USD',
      validate: {
        isIn: [['USD']], // Simplifié pour Portall
        len: [3, 3]
      },
      comment: 'Devise de la transaction'
    },
    
    // Statut du paiement (cycle de vie complet)
    status: {
      type: DataTypes.ENUM(
        'pending',    // En attente de traitement
        'succeeded',  // Paiement réussi
        'failed',     // Échec du paiement
        'cancelled',  // Annulé par l'utilisateur ou le système
        'refunded'    // Remboursé (partiellement ou totalement)
      ),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'succeeded', 'failed', 'cancelled', 'refunded']]
      },
      comment: 'Statut actuel de la transaction'
    },
    
    // Type de paiement pour analytics
    payment_type: {
      type: DataTypes.ENUM(
        'initial',      // Premier paiement d'un nouvel abonnement
        'recurring',    // Paiement récurrent automatique
        'retry',        // Nouvelle tentative après échec
        'upgrade',      // Changement de plan (mensuel vers annuel)
        'downgrade'     // Changement de plan (annuel vers mensuel)
      ),
      allowNull: false,
      defaultValue: 'initial',
      comment: 'Type de paiement pour classification business'
    },
    
    // Méthode de paiement utilisée
    payment_method: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Type de méthode de paiement (card, bank_transfer, etc.)'
    },
    
    // Derniers 4 chiffres de la carte (pour identification sans risque)
    card_last_four: {
      type: DataTypes.STRING(4),
      allowNull: true,
      validate: {
        len: [4, 4],
        isNumeric: true
      },
      comment: 'Derniers 4 chiffres de la carte pour identification'
    },
    
    // Marque de la carte (Visa, Mastercard, etc.)
    card_brand: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Marque de la carte utilisée'
    },
    
    // Raison de l'échec si applicable
    failure_reason: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Raison technique de l\'échec du paiement'
    },
    
    // Message d'échec pour l'utilisateur
    failure_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Message d\'erreur compréhensible pour l\'utilisateur'
    },
    
    // Date de traitement effectif du paiement
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp exact du traitement chez Stripe'
    },
    
    // Montant remboursé si applicable (en centimes)
    refunded_amount_in_cents: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true
      },
      comment: 'Montant remboursé en centimes'
    },
    
    // Date du remboursement
    refunded_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date du remboursement si applicable'
    },
    
    // Métadonnées pour informations additionnelles
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment: 'Informations additionnelles sur la transaction'
    }
  }, {
    tableName: 'payment_history',
    timestamps: true,
    underscored: true,
    
    // Configuration importante : pas de mise à jour après création
    // Cela respecte le principe d'immutabilité comptable
    hooks: {
      beforeUpdate: () => {
        throw new Error('PaymentHistory records are immutable - create a new record instead');
      }
    },
    
    // Index optimisés pour les requêtes business courantes
    indexes: [
      {
        fields: ['subscription_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['payment_type']
      },
      {
        fields: ['stripe_payment_intent_id'],
        unique: true,
        where: {
          stripe_payment_intent_id: {
            [sequelize.Sequelize.Op.ne]: null
          }
        }
      },
      {
        fields: ['processed_at']
      },
      {
        fields: ['created_at'] // Important pour les rapports chronologiques
      }
    ]
  });

  /**
   * Méthodes d'instance - Actions sur un paiement spécifique
   */
  
  // Formater le montant pour affichage
  PaymentHistory.prototype.getFormattedAmount = function() {
    const amount = (this.amount_in_cents / 100).toFixed(2);
    return `$${amount}`;
  };
  
  // Obtenir le montant remboursé formaté
  PaymentHistory.prototype.getFormattedRefundedAmount = function() {
    if (!this.refunded_amount_in_cents) return '$0.00';
    const amount = (this.refunded_amount_in_cents / 100).toFixed(2);
    return `$${amount}`;
  };
  
  // Vérifier si le paiement est remboursable
  PaymentHistory.prototype.isRefundable = function() {
    return this.status === 'succeeded' && 
           this.refunded_amount_in_cents < this.amount_in_cents;
  };
  
  // Calculer le montant remboursable restant
  PaymentHistory.prototype.getRefundableAmount = function() {
    if (!this.isRefundable()) return 0;
    return this.amount_in_cents - (this.refunded_amount_in_cents || 0);
  };
  
  // Obtenir un résumé pour l'affichage utilisateur
  PaymentHistory.prototype.getDisplaySummary = function() {
    return {
      id: this.id,
      amount: this.getFormattedAmount(),
      status: this.status,
      paymentType: this.payment_type,
      date: this.processed_at || this.created_at,
      paymentMethod: this.payment_method,
      cardInfo: this.card_brand && this.card_last_four ? 
                `${this.card_brand} •••• ${this.card_last_four}` : null,
      isRefunded: this.status === 'refunded',
      refundedAmount: this.getFormattedRefundedAmount()
    };
  };

  /**
   * Méthodes de classe (static) - Analyses et requêtes globales
   */
  
  // Obtenir l'historique d'un abonnement
  PaymentHistory.findBySubscription = function(subscriptionId, options = {}) {
    return this.findAll({
      where: {
        subscription_id: subscriptionId
      },
      order: [['created_at', 'DESC']],
      ...options
    });
  };
  
  // Calculer le revenu total sur une période
  PaymentHistory.calculateRevenue = function(startDate, endDate) {
    return this.sum('amount_in_cents', {
      where: {
        status: 'succeeded',
        processed_at: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        }
      }
    });
  };
  
  // Obtenir les statistiques d'échec de paiement
  PaymentHistory.getFailureStats = function(period = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);
    
    return this.findAll({
      attributes: [
        'failure_reason',
        [sequelize.Sequelize.fn('COUNT', '*'), 'count']
      ],
      where: {
        status: 'failed',
        created_at: {
          [sequelize.Sequelize.Op.gte]: startDate
        }
      },
      group: ['failure_reason'],
      order: [[sequelize.Sequelize.col('count'), 'DESC']]
    });
  };
  
  // Trouver les paiements nécessitant un retry
  PaymentHistory.findFailedPaymentsForRetry = function() {
    return this.findAll({
      where: {
        status: 'failed',
        payment_type: {
          [sequelize.Sequelize.Op.in]: ['initial', 'recurring']
        },
        // Échec dans les dernières 24h mais pas trop récent (attendre 1h)
        created_at: {
          [sequelize.Sequelize.Op.and]: [
            { [sequelize.Sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            { [sequelize.Sequelize.Op.lte]: new Date(Date.now() - 60 * 60 * 1000) }
          ]
        }
      },
      include: [{
        model: this.sequelize.models.UserSubscription,
        as: 'subscription',
        include: [{
          model: this.sequelize.models.User,
          as: 'user'
        }]
      }]
    });
  };

  // Associations avec les autres modèles
  PaymentHistory.associate = function(models) {
    // Appartient à un abonnement
    PaymentHistory.belongsTo(models.UserSubscription, {
      foreignKey: 'subscription_id',
      as: 'subscription'
    });
  };

  return PaymentHistory;
};