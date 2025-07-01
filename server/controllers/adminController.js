// portall/server/controllers/adminController.js

const { User, PlayerProfile, CoachProfile, NJCAACollege, NCAACollege } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database.connection');

/**
 * Contrôleur administratif pour la gestion des utilisateurs
 * 
 * Ce contrôleur gère toutes les opérations administratives liées
 * à la validation des comptes, la gestion des utilisateurs,
 * et la supervision de la plateforme.
 * 
 * Chaque méthode de ce contrôleur implémente une fonctionnalité
 * spécifique du workflow administratif décrit dans vos specs.
 */
class AdminController {
  /**
   * Récupère la liste des utilisateurs en attente de validation
   * 
   * Cette méthode est le point d'entrée principal pour les admins.
   * Elle fournit une vue d'ensemble de tous les comptes qui nécessitent
   * une attention administrative.
   * 
   * Analogie : C'est comme un trieur postal qui classe le courrier
   * en attente de traitement selon différents critères.
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
          [Op.ne]: 'admin' // Exclure les comptes admin
        }
      };

      // Filtrage par type d'utilisateur
      if (userType !== 'all') {
        whereConditions.userType = userType;
      }

      // Recherche textuelle (nom, email)
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
      // ENRICHISSEMENT DES DONNÉES POUR L'AFFICHAGE
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
        
        // Calculer le temps d'attente
        const waitingTime = Date.now() - new Date(user.createdAt).getTime();
        userData.waitingDays = Math.floor(waitingTime / (1000 * 60 * 60 * 24));
        
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
   * Cette méthode fournit des métriques importantes pour aider
   * les admins à comprendre la charge de travail et identifier
   * les tendances dans les inscriptions.
   */
  static async calculatePendingUserStats() {
    try {
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

      const totalPending = await User.count({
        where: {
          isActive: false,
          userType: { [Op.ne]: 'admin' }
        }
      });

      return {
        totalPending,
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
        byType: {},
        error: 'Stats calculation failed'
      };
    }
  }

  /**
   * Approuve un compte utilisateur en attente
   * 
   * Cette méthode active un compte utilisateur et déclenche
   * les notifications appropriées. C'est une action critique
   * qui doit être auditée et sécurisée.
   */
  static async approveUser(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { userId } = req.params;
      const { approvalNote = '' } = req.body;

      console.log(`✅ Admin ${req.admin.email} attempting to approve user ID: ${userId}`);

      // ========================
      // VÉRIFICATIONS DE SÉCURITÉ
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

      if (userToApprove.userType === 'admin') {
        await transaction.rollback();
        console.error(`🚨 SECURITY ALERT - Admin ${req.admin.email} tried to approve admin account ${userId}`);
        
        return res.status(403).json({
          status: 'error',
          message: 'Cannot approve admin accounts through this interface',
          code: 'ADMIN_APPROVAL_FORBIDDEN'
        });
      }

      if (userToApprove.isActive) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'User is already approved',
          code: 'USER_ALREADY_APPROVED'
        });
      }

      // ========================
      // ACTIVATION DU COMPTE
      // ========================
      
      await userToApprove.update({
        isActive: true,
        // Ajouter des métadonnées d'approbation
        approvedAt: new Date(),
        approvedBy: req.admin.id,
        approvalNote: approvalNote
      }, { transaction });

      // Si c'est un profil joueur, le rendre visible
      if (userToApprove.playerProfile) {
        await userToApprove.playerProfile.update({
          isProfileVisible: true
        }, { transaction });
      }

      await transaction.commit();

      // ========================
      // LOGGING ET AUDIT
      // ========================
      
      console.log(`🎉 User approved successfully: ${userToApprove.email} by admin ${req.admin.email}`);

      // TODO: Déclencher l'envoi d'email de notification
      // Cette partie sera implémentée dans le système d'emails

      return res.status(200).json({
        status: 'success',
        message: 'User approved successfully',
        data: {
          user: userToApprove.toPublicJSON(),
          approvalDetails: {
            approvedBy: req.admin.getFullName(),
            approvedAt: new Date(),
            note: approvalNote
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
   * Rejette un compte utilisateur en attente
   * 
   * Cette méthode rejette définitivement un compte avec une raison
   * documentée. Le compte peut être supprimé ou marqué comme rejeté
   * selon les politiques de l'entreprise.
   */
  static async rejectUser(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { userId } = req.params;
      const { rejectionReason, deleteAccount = false } = req.body;

      console.log(`❌ Admin ${req.admin.email} attempting to reject user ID: ${userId}`);

      // ========================
      // VALIDATION DES PARAMÈTRES
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
      // TRAITEMENT DU REJET
      // ========================
      
      if (deleteAccount) {
        // Suppression complète du compte et profils associés
        await userToReject.destroy({ transaction });
        console.log(`🗑️ User account deleted: ${userToReject.email} by admin ${req.admin.email}`);
      } else {
        // Marquer comme rejeté sans supprimer (pour audit)
        await userToReject.update({
          isActive: false,
          rejectedAt: new Date(),
          rejectedBy: req.admin.id,
          rejectionReason: rejectionReason.trim()
        }, { transaction });
        console.log(`📝 User account rejected: ${userToReject.email} by admin ${req.admin.email}`);
      }

      await transaction.commit();

      // TODO: Déclencher l'envoi d'email de notification de rejet

      return res.status(200).json({
        status: 'success',
        message: deleteAccount ? 'User account deleted successfully' : 'User account rejected successfully',
        data: {
          userId: userId,
          action: deleteAccount ? 'deleted' : 'rejected',
          rejectionDetails: {
            rejectedBy: req.admin.getFullName(),
            rejectedAt: new Date(),
            reason: rejectionReason.trim()
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
   * Cette méthode fournit toutes les informations nécessaires
   * à un admin pour prendre une décision éclairée sur un compte.
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
      // ENRICHISSEMENT DES DONNÉES
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
      userDetails.adminMetadata = {
        registrationAge: Math.floor((Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24)),
        lastActivity: user.lastLogin || user.updatedAt,
        hasProfile: !!(user.playerProfile || user.coachProfile),
        approvalHistory: {
          approvedAt: user.approvedAt || null,
          approvedBy: user.approvedBy || null,
          rejectedAt: user.rejectedAt || null,
          rejectedBy: user.rejectedBy || null,
          rejectionReason: user.rejectionReason || null
        }
      };

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
   * pour aider les admins à prioriser leurs actions.
   */
  static async getDashboard(req, res) {
    try {
      console.log(`📊 Admin ${req.admin.email} requesting dashboard`);

      // ========================
      // STATISTIQUES UTILISATEURS
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
      // ACTIVITÉ RÉCENTE
      // ========================
      
      const recentRegistrations = await User.findAll({
        where: {
          userType: { [Op.ne]: 'admin' },
          createdAt: {
            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 derniers jours
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

    return stats;
  }

  /**
   * Formate l'activité récente pour l'affichage dashboard
   */
  static formatRecentActivity(recentRegistrations) {
    const dailyStats = {};
    
    recentRegistrations.forEach(reg => {
      const date = new Date(reg.createdAt).toDateString();
      if (!dailyStats[date]) {
        dailyStats[date] = { players: 0, coaches: 0, total: 0 };
      }
      dailyStats[date][reg.userType + 's']++;
      dailyStats[date].total++;
    });

    return {
      totalLast7Days: recentRegistrations.length,
      dailyBreakdown: dailyStats,
      registrationRate: (recentRegistrations.length / 7).toFixed(1) + ' per day'
    };
  }

  /**
   * Génère des alertes automatiques pour le dashboard admin
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
            [Op.lt]: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // Plus de 3 jours
          }
        }
      });

      if (oldPendingCount > 0) {
        alerts.push({
          type: 'warning',
          message: `${oldPendingCount} accounts have been pending for more than 3 days`,
          action: 'Review pending accounts',
          priority: 'medium'
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

      if (todayRegistrations > 20) { // Seuil configurable
        alerts.push({
          type: 'info',
          message: `High registration activity today: ${todayRegistrations} new accounts`,
          action: 'Monitor for quality',
          priority: 'low'
        });
      }

    } catch (error) {
      console.error('Error generating dashboard alerts:', error);
      alerts.push({
        type: 'error',
        message: 'Unable to generate some alerts',
        action: 'Check system health',
        priority: 'high'
      });
    }

    return alerts;
  }
}

module.exports = AdminController;