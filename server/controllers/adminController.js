// portall/server/controllers/adminController.js

const { User, PlayerProfile, CoachProfile, NJCAACollege, NCAACollege } = require('../models');
const emailService = require('../services/emailService');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database.connection');

/**
 * 🎯 CONTRÔLEUR ADMINISTRATIF UNIFIÉ
 * 
 * CHANGEMENT MAJEUR : Ce contrôleur traite maintenant TOUS les types de coachs
 * de manière identique. Plus de workflow différentiel entre NCAA/NAIA et NJCAA.
 * 
 * Nouveau workflow pour TOUS les coachs :
 * Inscription → Validation Admin → Approbation → Dashboard Direct
 */
class AdminController {

  /**
   * 📊 Dashboard admin avec statistiques globales
   */
  static async getDashboard(req, res) {
    try {
      console.log(`📊 Admin dashboard requested by ${req.admin.email}`);

      // Statistiques simplifiées - plus de distinction entre types de coachs
      const totalUsers = await User.count();
      const pendingApprovals = await User.count({
        where: { isActive: false }
      });
      
      const userTypeStats = await User.findAll({
        attributes: [
          'userType',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: 'userType',
        raw: true
      });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentRegistrations = await User.count({
        where: {
          createdAt: {
            [Op.gte]: thirtyDaysAgo
          }
        }
      });

      const statusStats = {
        active: await User.count({ where: { isActive: true } }),
        pending: await User.count({ where: { isActive: false } }),
        total: totalUsers
      };

      const dashboardData = {
        overview: {
          totalUsers,
          pendingApprovals,
          recentRegistrations,
          activationRate: totalUsers > 0 ? 
            Math.round((statusStats.active / totalUsers) * 100) : 0
        },
        userTypes: {
          players: userTypeStats.find(stat => stat.userType === 'player')?.count || 0,
          // NOUVEAU : Tous les coachs regroupés
          allCoaches: (userTypeStats.find(stat => stat.userType === 'coach')?.count || 0) +
                     (userTypeStats.find(stat => stat.userType === 'njcaa_coach')?.count || 0),
          admins: userTypeStats.find(stat => stat.userType === 'admin')?.count || 0
        },
        status: statusStats,
        system: {
          version: '5.0.0',
          coachWorkflow: 'unified', // NOUVEAU : Indicateur workflow unifié
          paymentRequired: false    // NOUVEAU : Coachs n'ont plus besoin de payer
        }
      };

      console.log(`✅ Dashboard data compiled for admin ${req.admin.email}`);

      res.json({
        status: 'success',
        message: 'Admin dashboard data retrieved successfully',
        data: dashboardData
      });

    } catch (error) {
      console.error(`❌ Error generating admin dashboard for ${req.admin.email}:`, error);
      
      res.status(500).json({
        status: 'error',
        message: 'Failed to load dashboard data',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * 👥 Liste des utilisateurs en attente - Traitement unifié
   */
  static async getPendingUsers(req, res) {
    try {
      console.log(`📋 Admin ${req.admin.email} requesting pending users list`);

      const {
        page = 1,
        limit = 20,
        userType = 'all',
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search = ''
      } = req.query;

      const offset = (page - 1) * limit;

      let whereClause = {
        isActive: false,
        userType: { [Op.ne]: 'admin' }
      };

      // MODIFICATION : Traitement simplifié des types de coachs
      if (userType !== 'all') {
        if (userType === 'coach') {
          // Inclure tous les types de coachs
          whereClause.userType = { [Op.in]: ['coach', 'njcaa_coach'] };
        } else {
          whereClause.userType = userType;
        }
      }

      if (search) {
        whereClause[Op.or] = [
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const { count, rows: pendingUsers } = await User.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: PlayerProfile,
            as: 'playerProfile',
            required: false,
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
        distinct: true
      });

      // Enrichissement des données avec traitement unifié
      const enrichedUsers = pendingUsers.map(user => {
        const userData = user.toPublicJSON();
        
        if (user.playerProfile) {
          userData.profileInfo = {
            type: 'player',
            gender: user.playerProfile.gender,
            college: user.playerProfile.college,
            profileStatus: user.playerProfile.profileCompletionStatus
          };
        } else if (user.coachProfile) {
          userData.profileInfo = {
            type: 'coach', // UNIFIÉ : Plus de distinction visible
            position: user.coachProfile.position,
            division: user.coachProfile.division,
            teamSport: user.coachProfile.teamSport,
            college: user.coachProfile.college,
            originalType: user.userType // Conservé pour référence technique
          };
        }
        
        const waitingTime = Date.now() - new Date(user.createdAt).getTime();
        userData.waitingDays = Math.floor(waitingTime / (1000 * 60 * 60 * 24));
        userData.priority = userData.waitingDays > 3 ? 'high' : 
                           userData.waitingDays > 1 ? 'medium' : 'low';
        
        return userData;
      });

      const responseData = {
        users: enrichedUsers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalUsers: count,
          hasNext: page * limit < count,
          hasPrev: page > 1
        },
        filters: { userType, search, sortBy, sortOrder },
        summary: {
          totalPending: count,
          avgWaitingTime: enrichedUsers.length > 0 ? 
            Math.round(enrichedUsers.reduce((sum, user) => sum + user.waitingDays, 0) / enrichedUsers.length) : 0
        }
      };

      console.log(`✅ Retrieved ${enrichedUsers.length} pending users for admin review`);

      res.json({
        status: 'success',
        message: 'Pending users retrieved successfully',
        data: responseData
      });

    } catch (error) {
      console.error(`❌ Error fetching pending users for admin ${req.admin.email}:`, error);
      
      res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve pending users',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * ✅ MÉTHODE CLÉE : Approbation unifiée pour TOUS les utilisateurs
   * 
   * C'est ici que se fait la VRAIE modification ! Cette méthode traite maintenant
   * tous les coachs (NCAA/NAIA et NJCAA) exactement de la même façon.
   * Plus de redirection vers Stripe, plus de workflow différentiel.
   */
  static async approveUser(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { userId } = req.params;
      const { approvalNote = '' } = req.body;

      console.log(`✅ Admin ${req.admin.email} approving user ID: ${userId} with UNIFIED workflow`);

      // Récupération de l'utilisateur avec ses profils
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

      // Protection contre l'approbation de comptes admin
      if (userToApprove.userType === 'admin') {
        await transaction.rollback();
        console.error(`🚨 SECURITY: Admin ${req.admin.email} tried to approve admin account ${userId}`);
        
        return res.status(403).json({
          status: 'error',
          message: 'Cannot approve admin accounts through this interface',
          code: 'ADMIN_APPROVAL_FORBIDDEN'
        });
      }

      // Vérification que le compte n'est pas déjà approuvé
      if (userToApprove.isActive) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'User is already approved and active',
          code: 'USER_ALREADY_APPROVED'
        });
      }

      // ========================
      // 🎯 POINT CRUCIAL : ACTIVATION UNIFIÉE
      // ========================
      
      console.log(`🔄 Activating ${userToApprove.userType} account with UNIFIED workflow`);

      // Activation du compte pour TOUS les types d'utilisateurs
      await userToApprove.update({
        isActive: true,
        approvedAt: new Date(),
        approvedBy: req.admin.id,
        approvalNote: approvalNote.trim(),
        approvalWorkflow: 'unified_v2' // NOUVEAU : Marqueur du workflow unifié
      }, { transaction });

      // Pour les joueurs : rendre le profil visible automatiquement
      if (userToApprove.playerProfile) {
        await userToApprove.playerProfile.update({
          isProfileVisible: true
        }, { transaction });
        console.log(`👁️ Player profile made visible for user ${userId}`);
      }

      // ========================
      // 🎯 NOUVEAU : TOUS LES COACHS SUIVENT LE MÊME CHEMIN
      // ========================
      
      if (userToApprove.userType === 'coach' || userToApprove.userType === 'njcaa_coach') {
        console.log(`🎯 Coach approved - UNIFIED workflow applied for ${userToApprove.userType}`);
        
        // AVANT : Il y avait ici une logique différentielle pour rediriger 
        //         les coachs NCAA/NAIA vers Stripe
        // MAINTENANT : Tous les coachs sont traités identiquement
        //              et ont accès direct à leur dashboard après connexion
        
        // Plus aucune logique spéciale ici !
      }

      // Validation de la transaction avant envoi d'email
      await transaction.commit();

      // ========================
      // EMAIL DE NOTIFICATION UNIFIÉ
      // ========================
      
      let emailSent = false;
      let emailError = null;

      try {
        const emailResult = await emailService.sendAccountApprovedEmail(
          userToApprove, 
          req.admin.getFullName(),
          { workflow: 'unified' } // NOUVEAU : Template unifié
        );
        
        emailSent = emailResult.success;
        
        if (emailResult.success) {
          console.log(`📧 UNIFIED approval notification sent to ${userToApprove.email}`);
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
      // RÉPONSE AVEC WORKFLOW UNIFIÉ
      // ========================
      
      console.log(`🎉 User approved with UNIFIED workflow: ${userToApprove.email} (${userToApprove.userType})`);

      return res.status(200).json({
        status: 'success',
        message: emailSent 
          ? 'User approved successfully with unified workflow. Welcome email sent.' 
          : 'User approved successfully with unified workflow. Email notification failed but account is active.',
        data: {
          user: userToApprove.toPublicJSON(),
          approvalDetails: {
            approvedBy: req.admin.getFullName(),
            approvedAt: new Date(),
            note: approvalNote.trim(),
            workflow: 'unified_v2', // IMPORTANT : Indicateur du nouveau workflow
            nextSteps: userToApprove.userType === 'player' ? 
              'User can now log in and access their player dashboard' :
              'User can now log in and access their coach dashboard directly' // MÊME MESSAGE pour tous les coachs
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
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * ❌ Rejet d'un compte utilisateur (méthode inchangée)
   */
  static async rejectUser(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { userId } = req.params;
      const { rejectionReason = '', rejectionNote = '' } = req.body;

      console.log(`❌ Admin ${req.admin.email} rejecting user ID: ${userId}`);

      const userToReject = await User.findByPk(userId, {
        include: [
          { model: PlayerProfile, as: 'playerProfile' },
          { model: CoachProfile, as: 'coachProfile' }
        ],
        transaction
      });

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
        return res.status(403).json({
          status: 'error',
          message: 'Cannot reject admin accounts',
          code: 'ADMIN_REJECTION_FORBIDDEN'
        });
      }

      if (userToReject.isActive) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Cannot reject an already approved user',
          code: 'USER_ALREADY_APPROVED'
        });
      }

      // Email de rejet avant modification
      let emailSent = false;
      try {
        const emailResult = await emailService.sendAccountRejectedEmail(
          userToReject, 
          rejectionReason, 
          rejectionNote,
          req.admin.getFullName()
        );
        emailSent = emailResult.success;
      } catch (error) {
        console.error('❌ Rejection email error:', error);
      }

      // Marquer comme rejeté
      await userToReject.update({
        isActive: false,
        rejectedAt: new Date(),
        rejectedBy: req.admin.id,
        rejectionReason,
        rejectionNote: rejectionNote.trim()
      }, { transaction });

      await transaction.commit();

      console.log(`❌ User rejected: ${userToReject.email} by admin ${req.admin.email}`);

      return res.status(200).json({
        status: 'success',
        message: emailSent 
          ? 'User rejected successfully. Notification email sent.' 
          : 'User rejected successfully. Email notification failed.',
        data: {
          rejectionDetails: {
            rejectedBy: req.admin.getFullName(),
            rejectedAt: new Date(),
            reason: rejectionReason,
            note: rejectionNote.trim()
          },
          email: { sent: emailSent }
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error(`❌ Error rejecting user ${req.params.userId} by admin ${req.admin.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'User rejection failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * 👤 Détails d'un utilisateur (méthode inchangée dans sa logique)
   */
  static async getUserDetails(req, res) {
    try {
      const { userId } = req.params;

      console.log(`👤 Admin ${req.admin.email} requesting details for user ${userId}`);

      const user = await User.findByPk(userId, {
        include: [
          {
            model: PlayerProfile,
            as: 'playerProfile',
            include: [{ model: NJCAACollege, as: 'college' }]
          },
          {
            model: CoachProfile,
            as: 'coachProfile',
            include: [{ model: NCAACollege, as: 'college' }]
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

      const userDetails = user.toPublicJSON();
      
      const registrationAge = Math.floor(
        (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      userDetails.adminMetadata = {
        registrationDate: user.createdAt,
        registrationAge: registrationAge === 0 ? 'Today' : 
                         registrationAge === 1 ? '1 day ago' : 
                         `${registrationAge} days ago`,
        lastActivity: user.lastLogin || user.updatedAt,
        hasProfile: !!(user.playerProfile || user.coachProfile),
        profileComplete: user.playerProfile ? 
          user.playerProfile.profileCompletionStatus !== 'basic' : 
          true,
        approvalHistory: {
          approvedAt: user.approvedAt || null,
          approvedBy: user.approvedBy || null,
          rejectedAt: user.rejectedAt || null,
          rejectedBy: user.rejectedBy || null,
          rejectionReason: user.rejectionReason || null,
          approvalWorkflow: user.approvalWorkflow || 'legacy' // NOUVEAU : Indicateur workflow
        }
      };

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
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = AdminController;