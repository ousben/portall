// portall/server/controllers/adminController.js

const { User, PlayerProfile, CoachProfile, NJCAACollege, NCAACollege } = require('../models');
const emailService = require('../services/emailService'); // NOUVEAU: Service d'emails intégré
const { Op } = require('sequelize');
const { sequelize } = require('../config/database.connection');

/**
 * Contrôleur administratif pour la gestion des utilisateurs avec notifications email
 * 
 * Ce contrôleur gère toutes les opérations administratives liées à la validation
 * des comptes, la gestion des utilisateurs, et la supervision de la plateforme.
 * 
 * Nouveautés Phase 3 avec emails :
 * - Approbation de comptes avec notification email automatique
 * - Rejet de comptes avec email explicatif personnalisé
 * - Dashboard enrichi avec statistiques en temps réel
 * - Logging complet de toutes les actions admin pour audit
 * 
 * Chaque méthode de ce contrôleur implémente une fonctionnalité spécifique
 * du workflow administratif avec une intégration transparente du système d'emails.
 */
class AdminController {
  /**
   * Récupère la liste des utilisateurs en attente de validation
   * 
   * Cette méthode est le point d'entrée principal pour les admins.
   * Elle fournit une vue d'ensemble de tous les comptes qui nécessitent
   * une attention administrative, avec des filtres et une pagination avancée.
   * 
   * Analogie : C'est comme un système de triage dans un hôpital qui classe
   * les patients par urgence et type de traitement nécessaire.
   */
  static async getPendingUsers(req, res) {
    try {
      console.log(`📋 Admin ${req.admin.email} requesting pending users list`);

      // ========================
      // PARAMÈTRES DE FILTRAGE ET PAGINATION
      // ========================
      
      const {
        page = 1,
        limit = 20,
        userType = 'all', // 'all', 'player', 'coach'
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search = ''
      } = req.query;

      const offset = (page - 1) * limit;

      // ========================
      // CONSTRUCTION DES CONDITIONS DE RECHERCHE
      // ========================
      
      const whereConditions = {
        isActive: false, // Seulement les comptes en attente
        userType: {
          [Op.ne]: 'admin' // Exclure les comptes admin de la liste
        }
      };

      // Filtrage par type d'utilisateur
      if (userType !== 'all') {
        whereConditions.userType = userType;
      }

      // Recherche textuelle dans nom, prénom, email
      if (search) {
        whereConditions[Op.or] = [
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } }
        ];
      }

      // ========================
      // REQUÊTE PRINCIPALE AVEC RELATIONS
      // ========================
      
      const { count, rows: pendingUsers } = await User.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: PlayerProfile,
            as: 'playerProfile',
            required: false, // LEFT JOIN pour inclure même si pas de profil
            include: [
              {
                model: NJCAACollege,
                as: 'college',
                attributes: ['id', 'name', 'state', 'region']
              }
            ]
          },
          {
            model: CoachProfile,
            as: 'coachProfile',
            required: false,
            include: [
              {
                model: NCAACollege,
                as: 'college',
                attributes: ['id', 'name', 'state', 'division']
              }
            ]
          }
        ],
        order: [[sortBy, sortOrder.toUpperCase()]],
        limit: parseInt(limit),
        offset: offset,
        distinct: true // Important pour COUNT avec JOIN
      });

      // ========================
      // ENRICHISSEMENT DES DONNÉES POUR L'AFFICHAGE ADMIN
      // ========================
      
      const enrichedUsers = pendingUsers.map(user => {
        const userData = user.toPublicJSON();
        
        // Ajouter des informations contextuelles pour l'admin
        if (user.playerProfile) {
          userData.profileInfo = {
            type: 'player',
            gender: user.playerProfile.gender,
            college: user.playerProfile.college,
            profileStatus: user.playerProfile.profileCompletionStatus
          };
        } else if (user.coachProfile) {
          userData.profileInfo = {
            type: 'coach',
            position: user.coachProfile.position,
            division: user.coachProfile.division,
            teamSport: user.coachProfile.teamSport,
            college: user.coachProfile.college
          };
        }
        
        // Calculer le temps d'attente pour prioriser les actions
        const waitingTime = Date.now() - new Date(user.createdAt).getTime();
        userData.waitingDays = Math.floor(waitingTime / (1000 * 60 * 60 * 24));
        
        // Ajouter des indicateurs de priorité
        if (userData.waitingDays > 3) {
          userData.priority = 'high';
        } else if (userData.waitingDays > 1) {
          userData.priority = 'medium';
        } else {
          userData.priority = 'low';
        }
        
        return userData;
      });

      // ========================
      // STATISTIQUES POUR LE DASHBOARD ADMIN
      // ========================
      
      const stats = await this.calculatePendingUserStats();

      console.log(`✅ Returned ${enrichedUsers.length} pending users to admin ${req.admin.email}`);

      return res.status(200).json({
        status: 'success',
        message: 'Pending users retrieved successfully',
        data: {
          users: enrichedUsers,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            totalPages: Math.ceil(count / limit)
          },
          filters: {
            userType,
            search,
            sortBy,
            sortOrder
          },
          statistics: stats
        }
      });

    } catch (error) {
      console.error(`❌ Error fetching pending users for admin ${req.admin.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve pending users',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * Calcule les statistiques des utilisateurs en attente
   * 
   * Cette méthode fournit des métriques importantes pour aider les admins
   * à comprendre la charge de travail et identifier les tendances dans
   * les inscriptions. Ces données alimentent le dashboard admin.
   */
  static async calculatePendingUserStats() {
    try {
      // Statistiques par type d'utilisateur avec temps d'attente moyen
      const stats = await User.findAll({
        where: {
          isActive: false,
          userType: { [Op.ne]: 'admin' }
        },
        attributes: [
          'userType',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('AVG', 
            sequelize.literal('EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400')
          ), 'avgWaitingDays']
        ],
        group: ['userType'],
        raw: true
      });

      // Nombre total de comptes en attente
      const totalPending = await User.count({
        where: {
          isActive: false,
          userType: { [Op.ne]: 'admin' }
        }
      });

      // Comptes en attente depuis plus de 3 jours (alerte)
      const urgentCount = await User.count({
        where: {
          isActive: false,
          userType: { [Op.ne]: 'admin' },
          createdAt: {
            [Op.lt]: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          }
        }
      });

      return {
        totalPending,
        urgentCount,
        byType: stats.reduce((acc, stat) => {
          acc[stat.userType] = {
            count: parseInt(stat.count),
            averageWaitingDays: parseFloat(stat.avgWaitingDays || 0).toFixed(1)
          };
          return acc;
        }, {}),
        lastUpdated: new Date()
      };

    } catch (error) {
      console.error('Error calculating pending user stats:', error);
      return {
        totalPending: 0,
        urgentCount: 0,
        byType: {},
        error: 'Stats calculation failed'
      };
    }
  }

  /**
   * MISE À JOUR : Approuve un compte utilisateur avec notification email
   * 
   * Cette méthode active un compte utilisateur et déclenche automatiquement
   * l'envoi d'un email de notification à l'utilisateur. C'est une action
   * critique qui doit être auditée et sécurisée.
   * 
   * Processus d'approbation :
   * 1. Vérifications de sécurité strictes
   * 2. Activation du compte en base de données
   * 3. Rendu des profils joueurs visibles
   * 4. Envoi automatique d'email de notification
   * 5. Logging pour audit
   */
  static async approveUser(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { userId } = req.params;
      const { approvalNote = '' } = req.body;

      console.log(`✅ Admin ${req.admin.email} attempting to approve user ID: ${userId}`);

      // ========================
      // VÉRIFICATIONS DE SÉCURITÉ RENFORCÉES
      // ========================
      
      const userToApprove = await User.findByPk(userId, {
        include: [
          { model: PlayerProfile, as: 'playerProfile' },
          { model: CoachProfile, as: 'coachProfile' }
        ],
        transaction
      });

      if (!userToApprove) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Empêcher l'approbation de comptes admin via cette interface
      if (userToApprove.userType === 'admin') {
        await transaction.rollback();
        console.error(`🚨 SECURITY ALERT - Admin ${req.admin.email} tried to approve admin account ${userId}`);
        
        return res.status(403).json({
          status: 'error',
          message: 'Cannot approve admin accounts through this interface',
          code: 'ADMIN_APPROVAL_FORBIDDEN'
        });
      }

      // Vérifier que le compte n'est pas déjà approuvé
      if (userToApprove.isActive) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'User is already approved',
          code: 'USER_ALREADY_APPROVED'
        });
      }

      // ========================
      // PROCESSUS D'ACTIVATION DU COMPTE
      // ========================
      
      // Activer le compte avec métadonnées d'approbation
      await userToApprove.update({
        isActive: true,
        // Ajouter des métadonnées d'approbation pour audit
        approvedAt: new Date(),
        approvedBy: req.admin.id,
        approvalNote: approvalNote.trim()
      }, { transaction });

      // Si c'est un profil joueur, le rendre automatiquement visible
      if (userToApprove.playerProfile) {
        await userToApprove.playerProfile.update({
          isProfileVisible: true
        }, { transaction });
        console.log(`👁️ Player profile made visible for user ${userId}`);
      }

      // Finaliser la transaction avant l'envoi d'email
      await transaction.commit();

      // ========================
      // NOUVEAU : EMAIL DE NOTIFICATION D'APPROBATION
      // ========================
      
      let emailSent = false;
      let emailError = null;

      try {
        const emailResult = await emailService.sendAccountApprovedEmail(
          userToApprove, 
          req.admin.getFullName()
        );
        
        emailSent = emailResult.success;
        
        if (emailResult.success) {
          console.log(`📧 Approval notification sent to ${userToApprove.email}`);
          // En développement, afficher le lien de preview
          if (emailResult.previewUrl) {
            console.log(`👀 Email preview: ${emailResult.previewUrl}`);
          }
        } else {
          emailError = emailResult.error;
          console.error(`❌ Failed to send approval email:`, emailResult.error);
        }
        
      } catch (error) {
        emailError = error.message;
        console.error(`❌ Approval email error:`, error);
      }

      // ========================
      // LOGGING POUR AUDIT
      // ========================
      
      console.log(`🎉 User approved successfully: ${userToApprove.email} by admin ${req.admin.email}`);

      return res.status(200).json({
        status: 'success',
        message: emailSent 
          ? 'User approved successfully. Notification email sent.' 
          : 'User approved successfully. Email notification failed but account is active.',
        data: {
          user: userToApprove.toPublicJSON(),
          approvalDetails: {
            approvedBy: req.admin.getFullName(),
            approvedAt: new Date(),
            note: approvalNote.trim()
          },
          email: {
            sent: emailSent,
            error: emailError
          }
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error(`❌ Error approving user ${req.params.userId} by admin ${req.admin.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'User approval failed',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * MISE À JOUR : Rejette un compte utilisateur avec notification email
   * 
   * Cette méthode rejette définitivement un compte avec une raison
   * documentée et envoie automatiquement un email explicatif à l'utilisateur.
   * Le compte peut être supprimé ou marqué comme rejeté selon la politique.
   * 
   * Processus de rejet :
   * 1. Validation stricte des paramètres
   * 2. Vérifications de sécurité
   * 3. Envoi d'email AVANT modification (pour garder les données)
   * 4. Suppression ou marquage comme rejeté
   * 5. Logging complet pour audit
   */
  static async rejectUser(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { userId } = req.params;
      const { rejectionReason, deleteAccount = false } = req.body;

      console.log(`❌ Admin ${req.admin.email} attempting to reject user ID: ${userId}`);

      // ========================
      // VALIDATION STRICTE DES PARAMÈTRES
      // ========================
      
      if (!rejectionReason || rejectionReason.trim().length < 10) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Rejection reason is required (minimum 10 characters)',
          code: 'REJECTION_REASON_REQUIRED'
        });
      }

      const userToReject = await User.findByPk(userId, { transaction });

      if (!userToReject) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Empêcher le rejet de comptes admin
      if (userToReject.userType === 'admin') {
        await transaction.rollback();
        console.error(`🚨 SECURITY ALERT - Admin ${req.admin.email} tried to reject admin account ${userId}`);
        
        return res.status(403).json({
          status: 'error',
          message: 'Cannot reject admin accounts through this interface',
          code: 'ADMIN_REJECTION_FORBIDDEN'
        });
      }

      // ========================
      // ENVOI D'EMAIL AVANT MODIFICATION/SUPPRESSION
      // ========================
      
      let emailSent = false;
      let emailError = null;

      // Envoyer l'email de rejet AVANT de modifier l'utilisateur
      // (car on a besoin des données complètes pour l'email)
      if (!deleteAccount) {
        try {
          const emailResult = await emailService.sendAccountRejectedEmail(
            userToReject, 
            rejectionReason.trim(), 
            req.admin.getFullName()
          );
          
          emailSent = emailResult.success;
          
          if (emailResult.success) {
            console.log(`📧 Rejection notification sent to ${userToReject.email}`);
            if (emailResult.previewUrl) {
              console.log(`👀 Email preview: ${emailResult.previewUrl}`);
            }
          } else {
            emailError = emailResult.error;
            console.error(`❌ Failed to send rejection email:`, emailResult.error);
          }
          
        } catch (error) {
          emailError = error.message;
          console.error(`❌ Rejection email error:`, error);
        }
      }

      // ========================
      // TRAITEMENT DU REJET (SUPPRESSION OU MARQUAGE)
      // ========================
      
      if (deleteAccount) {
        // Suppression complète du compte et profils associés
        await userToReject.destroy({ transaction });
        console.log(`🗑️ User account deleted: ${userToReject.email} by admin ${req.admin.email}`);
      } else {
        // Marquer comme rejeté sans supprimer (pour audit et réinscription possible)
        await userToReject.update({
          isActive: false,
          rejectedAt: new Date(),
          rejectedBy: req.admin.id,
          rejectionReason: rejectionReason.trim()
        }, { transaction });
        console.log(`📝 User account rejected: ${userToReject.email} by admin ${req.admin.email}`);
      }

      await transaction.commit();

      return res.status(200).json({
        status: 'success',
        message: deleteAccount 
          ? 'User account deleted successfully' 
          : emailSent 
            ? 'User account rejected successfully. Notification email sent.'
            : 'User account rejected successfully. Email notification failed.',
        data: {
          userId: userId,
          action: deleteAccount ? 'deleted' : 'rejected',
          rejectionDetails: {
            rejectedBy: req.admin.getFullName(),
            rejectedAt: new Date(),
            reason: rejectionReason.trim()
          },
          email: {
            sent: emailSent,
            error: emailError
          }
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error(`❌ Error rejecting user ${req.params.userId} by admin ${req.admin.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'User rejection failed',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * Récupère les détails complets d'un utilisateur pour révision
   * 
   * Cette méthode fournit toutes les informations nécessaires à un admin
   * pour prendre une décision éclairée sur un compte. Elle inclut le
   * profil complet, l'historique, et des métadonnées utiles.
   */
  static async getUserDetails(req, res) {
    try {
      const { userId } = req.params;

      console.log(`🔍 Admin ${req.admin.email} requesting details for user ID: ${userId}`);

      const user = await User.findByPk(userId, {
        include: [
          {
            model: PlayerProfile,
            as: 'playerProfile',
            include: [
              {
                model: NJCAACollege,
                as: 'college',
                attributes: ['id', 'name', 'state', 'region', 'isActive']
              }
            ]
          },
          {
            model: CoachProfile,
            as: 'coachProfile',
            include: [
              {
                model: NCAACollege,
                as: 'college',
                attributes: ['id', 'name', 'state', 'division', 'isActive']
              }
            ]
          }
        ]
      });

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // ========================
      // ENRICHISSEMENT DES DONNÉES POUR RÉVISION ADMIN
      // ========================
      
      const userDetails = user.toPublicJSON();
      
      // Ajouter les informations du profil selon le type
      if (user.playerProfile) {
        userDetails.profile = {
          type: 'player',
          ...user.playerProfile.toJSON()
        };
      } else if (user.coachProfile) {
        userDetails.profile = {
          type: 'coach',
          ...user.coachProfile.toJSON()
        };
      }

      // Ajouter des métadonnées utiles pour l'admin
      const registrationAge = Math.floor((Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));
      
      userDetails.adminMetadata = {
        registrationAge: registrationAge,
        registrationAgeText: registrationAge === 0 ? 'Today' : 
                           registrationAge === 1 ? '1 day ago' : 
                           `${registrationAge} days ago`,
        lastActivity: user.lastLogin || user.updatedAt,
        hasProfile: !!(user.playerProfile || user.coachProfile),
        profileComplete: user.playerProfile ? 
          user.playerProfile.profileCompletionStatus !== 'basic' : 
          true, // Les coaches sont considérés complets à l'inscription
        approvalHistory: {
          approvedAt: user.approvedAt || null,
          approvedBy: user.approvedBy || null,
          rejectedAt: user.rejectedAt || null,
          rejectedBy: user.rejectedBy || null,
          rejectionReason: user.rejectionReason || null
        }
      };

      // Ajouter des recommandations d'action pour l'admin
      userDetails.recommendations = [];
      
      if (registrationAge > 3) {
        userDetails.recommendations.push({
          type: 'urgent',
          message: 'Account has been pending for more than 3 days',
          action: 'Review and process immediately'
        });
      }
      
      if (!userDetails.adminMetadata.hasProfile) {
        userDetails.recommendations.push({
          type: 'warning',
          message: 'User has no associated profile',
          action: 'Investigate profile creation issue'
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'User details retrieved successfully',
        data: {
          user: userDetails
        }
      });

    } catch (error) {
      console.error(`❌ Error fetching user details ${req.params.userId} for admin ${req.admin.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve user details',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * Récupère le dashboard admin avec statistiques globales
   * 
   * Cette méthode fournit une vue d'ensemble de l'état de la plateforme
   * pour aider les admins à prioriser leurs actions et identifier les tendances.
   */
  static async getDashboard(req, res) {
    try {
      console.log(`📊 Admin ${req.admin.email} requesting dashboard`);

      // ========================
      // STATISTIQUES UTILISATEURS GLOBALES
      // ========================
      
      const userStats = await User.findAll({
        attributes: [
          'userType',
          'isActive',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: {
          userType: { [Op.ne]: 'admin' }
        },
        group: ['userType', 'isActive'],
        raw: true
      });

      // ========================
      // ACTIVITÉ RÉCENTE (7 DERNIERS JOURS)
      // ========================
      
      const recentRegistrations = await User.findAll({
        where: {
          userType: { [Op.ne]: 'admin' },
          createdAt: {
            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        },
        attributes: ['userType', 'createdAt', 'isActive'],
        order: [['createdAt', 'DESC']],
        limit: 50
      });

      // ========================
      // FORMATER LES DONNÉES POUR LE DASHBOARD
      // ========================
      
      const dashboard = {
        userStatistics: this.formatUserStatistics(userStats),
        recentActivity: this.formatRecentActivity(recentRegistrations),
        alerts: await this.generateDashboardAlerts(),
        systemHealth: await this.getSystemHealthMetrics(),
        lastUpdated: new Date()
      };

      return res.status(200).json({
        status: 'success',
        message: 'Admin dashboard retrieved successfully',
        data: dashboard
      });

    } catch (error) {
      console.error(`❌ Error generating admin dashboard for ${req.admin.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to generate admin dashboard',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * Formate les statistiques utilisateurs pour l'affichage dashboard
   * 
   * Cette méthode transforme les données brutes de la base en
   * structures facilement consommables par le frontend.
   */
  static formatUserStatistics(rawStats) {
    const stats = {
      players: { active: 0, pending: 0, total: 0 },
      coaches: { active: 0, pending: 0, total: 0 },
      totals: { active: 0, pending: 0, total: 0 }
    };

    rawStats.forEach(stat => {
      const type = stat.userType;
      const isActive = stat.isActive;
      const count = parseInt(stat.count);

      if (stats[type + 's']) {
        stats[type + 's'][isActive ? 'active' : 'pending'] = count;
        stats[type + 's'].total += count;
      }

      stats.totals[isActive ? 'active' : 'pending'] += count;
      stats.totals.total += count;
    });

    // Calculer les pourcentages d'approbation
    Object.keys(stats).forEach(key => {
      if (stats[key].total > 0) {
        stats[key].approvalRate = ((stats[key].active / stats[key].total) * 100).toFixed(1);
      } else {
        stats[key].approvalRate = '0.0';
      }
    });

    return stats;
  }

  /**
   * Formate l'activité récente pour l'affichage dashboard
   * 
   * Cette méthode analyse les inscriptions récentes pour identifier
   * les tendances et patterns d'utilisation.
   */
  static formatRecentActivity(recentRegistrations) {
    const dailyStats = {};
    const now = new Date();
    
    // Initialiser les 7 derniers jours
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toDateString();
      dailyStats[dateKey] = { players: 0, coaches: 0, total: 0 };
    }
    
    // Remplir avec les données réelles
    recentRegistrations.forEach(reg => {
      const date = new Date(reg.createdAt).toDateString();
      if (dailyStats[date]) {
        dailyStats[date][reg.userType + 's']++;
        dailyStats[date].total++;
      }
    });

    const totalLast7Days = recentRegistrations.length;
    const averagePerDay = (totalLast7Days / 7).toFixed(1);

    return {
      totalLast7Days,
      averagePerDay,
      dailyBreakdown: dailyStats,
      trend: this.calculateTrend(dailyStats)
    };
  }

  /**
   * Calcule la tendance d'activité (croissante, stable, décroissante)
   */
  static calculateTrend(dailyStats) {
    const values = Object.values(dailyStats).map(day => day.total);
    const firstHalf = values.slice(0, 3).reduce((a, b) => a + b, 0);
    const secondHalf = values.slice(4, 7).reduce((a, b) => a + b, 0);
    
    if (secondHalf > firstHalf * 1.2) return 'increasing';
    if (secondHalf < firstHalf * 0.8) return 'decreasing';
    return 'stable';
  }

  /**
   * Génère des alertes automatiques pour le dashboard admin
   * 
   * Cette méthode analyse automatiquement l'état de la plateforme
   * et génère des alertes pour les situations nécessitant attention.
   */
  static async generateDashboardAlerts() {
    const alerts = [];

    try {
      // Alerte : Comptes en attente depuis trop longtemps
      const oldPendingCount = await User.count({
        where: {
          isActive: false,
          userType: { [Op.ne]: 'admin' },
          createdAt: {
            [Op.lt]: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          }
        }
      });

      if (oldPendingCount > 0) {
        alerts.push({
          type: 'warning',
          message: `${oldPendingCount} accounts have been pending for more than 3 days`,
          action: 'Review pending accounts',
          priority: 'medium',
          icon: '⏰'
        });
      }

      // Alerte : Pic d'inscriptions
      const todayRegistrations = await User.count({
        where: {
          userType: { [Op.ne]: 'admin' },
          createdAt: {
            [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      });

      if (todayRegistrations > 20) {
        alerts.push({
          type: 'info',
          message: `High registration activity today: ${todayRegistrations} new accounts`,
          action: 'Monitor for quality',
          priority: 'low',
          icon: '📈'
        });
      }

      // Alerte : Ratio de rejet élevé
      const rejectedLastWeek = await User.count({
        where: {
          rejectedAt: {
            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      });

      const totalLastWeek = await User.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          },
          userType: { [Op.ne]: 'admin' }
        }
      });

      if (totalLastWeek > 0 && (rejectedLastWeek / totalLastWeek) > 0.3) {
        alerts.push({
          type: 'warning',
          message: `High rejection rate this week: ${((rejectedLastWeek / totalLastWeek) * 100).toFixed(1)}%`,
          action: 'Review rejection criteria',
          priority: 'medium',
          icon: '⚠️'
        });
      }

    } catch (error) {
      console.error('Error generating dashboard alerts:', error);
      alerts.push({
        type: 'error',
        message: 'Unable to generate some alerts',
        action: 'Check system health',
        priority: 'high',
        icon: '🚨'
      });
    }

    return alerts;
  }

  /**
   * NOUVELLE MÉTHODE : Récupère les métriques de santé système
   * 
   * Cette méthode fournit des indicateurs sur la santé générale
   * de la plateforme pour le monitoring admin.
   */
  static async getSystemHealthMetrics() {
    try {
      const [
        totalUsers,
        activeUsers,
        totalProfiles,
        recentLogins
      ] = await Promise.all([
        User.count({ where: { userType: { [Op.ne]: 'admin' } } }),
        User.count({ where: { userType: { [Op.ne]: 'admin' }, isActive: true } }),
        Promise.all([
          PlayerProfile.count(),
          CoachProfile.count()
        ]).then(([players, coaches]) => players + coaches),
        User.count({
          where: {
            lastLogin: {
              [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        })
      ]);

      return {
        totalUsers,
        activeUsers,
        totalProfiles,
        recentLogins,
        activationRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : '0.0',
        profileCompletionRate: totalUsers > 0 ? ((totalProfiles / totalUsers) * 100).toFixed(1) : '0.0',
        dailyActiveUsers: recentLogins
      };

    } catch (error) {
      console.error('Error calculating system health metrics:', error);
      return {
        error: 'Unable to calculate metrics'
      };
    }
  }
}

module.exports = AdminController;