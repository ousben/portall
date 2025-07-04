// portall/server/migrations/20250704093412-create-subscription-tables.js

'use strict';

/**
 * Migration pour créer les tables de gestion des abonnements Portall
 * 
 * Cette migration établit la base de données nécessaire pour gérer :
 * 1. Les plans d'abonnement disponibles
 * 2. Les abonnements individuels des utilisateurs
 * 3. L'historique des paiements
 * 
 * Architecture simplifiée selon les spécifications Portall :
 * - 2 plans seulement (mensuel 29.99, annuel 79.99)
 * - Pas d'essai gratuit
 * - Mêmes fonctionnalités pour tous
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('💳 Creating subscription management tables...');
    
    // =======================
    // TABLE 1: SUBSCRIPTION_PLANS
    // =======================
    console.log('📋 Creating subscription_plans table...');
    
    await queryInterface.createTable('subscription_plans', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
        comment: 'Identifiant unique du plan'
      },
      
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Nom public du plan'
      },
      
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Description marketing du plan'
      },
      
      price_in_cents: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Prix en centimes (2999 pour 29.99 USD)'
      },
      
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'USD',
        comment: 'Devise ISO 4217'
      },
      
      billing_interval: {
        type: Sequelize.ENUM('month', 'year'),
        allowNull: false,
        comment: 'Fréquence de facturation'
      },
      
      allowed_user_types: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: '["coach", "player"]',
        comment: 'Types d\'utilisateurs autorisés'
      },
      
      features: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: '{}',
        comment: 'Fonctionnalités incluses'
      },
      
      stripe_price_id: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
        comment: 'ID du prix chez Stripe'
      },
      
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Plan disponible pour nouveaux abonnements'
      },
      
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Ordre d\'affichage'
      },
      
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Index pour subscription_plans
    await queryInterface.addIndex('subscription_plans', ['is_active']);
    await queryInterface.addIndex('subscription_plans', ['billing_interval']);
    await queryInterface.addIndex('subscription_plans', ['display_order']);
    await queryInterface.addIndex('subscription_plans', ['stripe_price_id'], {
      unique: true,
      where: {
        stripe_price_id: { [Sequelize.Op.ne]: null }
      }
    });

    // =======================
    // TABLE 2: USER_SUBSCRIPTIONS
    // =======================
    console.log('👤 Creating user_subscriptions table...');
    
    await queryInterface.createTable('user_subscriptions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
        comment: 'Identifiant unique de l\'abonnement'
      },
      
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true, // Un utilisateur = un abonnement max
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Référence vers l\'utilisateur'
      },
      
      plan_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'subscription_plans',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Référence vers le plan souscrit'
      },
      
      status: {
        type: Sequelize.ENUM('active', 'pending', 'cancelled', 'expired', 'suspended'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Statut actuel de l\'abonnement'
      },
      
      stripe_subscription_id: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
        comment: 'ID de l\'abonnement chez Stripe'
      },
      
      stripe_customer_id: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'ID du client chez Stripe'
      },
      
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Date de début de l\'abonnement'
      },
      
      ends_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Date de fin de la période payée'
      },
      
      cancelled_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Date d\'annulation'
      },
      
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: '{}',
        comment: 'Métadonnées additionnelles'
      },
      
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Index pour user_subscriptions
    await queryInterface.addIndex('user_subscriptions', ['user_id'], { unique: true });
    await queryInterface.addIndex('user_subscriptions', ['status']);
    await queryInterface.addIndex('user_subscriptions', ['stripe_subscription_id'], {
      unique: true,
      where: {
        stripe_subscription_id: { [Sequelize.Op.ne]: null }
      }
    });
    await queryInterface.addIndex('user_subscriptions', ['ends_at']);

    // =======================
    // TABLE 3: PAYMENT_HISTORY
    // =======================
    console.log('💰 Creating payment_history table...');
    
    await queryInterface.createTable('payment_history', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
        comment: 'Identifiant unique du paiement'
      },
      
      subscription_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'user_subscriptions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Référence vers l\'abonnement'
      },
      
      stripe_payment_intent_id: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
        comment: 'ID du PaymentIntent chez Stripe'
      },
      
      stripe_invoice_id: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'ID de la facture chez Stripe'
      },
      
      amount_in_cents: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Montant payé en centimes'
      },
      
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'USD',
        comment: 'Devise du paiement'
      },
      
      status: {
        type: Sequelize.ENUM('pending', 'succeeded', 'failed', 'cancelled', 'refunded'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Statut du paiement'
      },
      
      payment_method: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Méthode de paiement utilisée'
      },
      
      failure_reason: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Raison de l\'échec si applicable'
      },
      
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Date de traitement du paiement'
      },
      
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Index pour payment_history
    await queryInterface.addIndex('payment_history', ['subscription_id']);
    await queryInterface.addIndex('payment_history', ['status']);
    await queryInterface.addIndex('payment_history', ['stripe_payment_intent_id'], {
      unique: true,
      where: {
        stripe_payment_intent_id: { [Sequelize.Op.ne]: null }
      }
    });
    await queryInterface.addIndex('payment_history', ['processed_at']);

    console.log('✅ Subscription tables created successfully!');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Dropping subscription tables...');
    
    // Supprimer dans l'ordre inverse pour respecter les contraintes
    await queryInterface.dropTable('payment_history');
    await queryInterface.dropTable('user_subscriptions');
    await queryInterface.dropTable('subscription_plans');
    
    console.log('✅ Subscription tables dropped successfully!');
  }
};