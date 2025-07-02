// portall/server/controllers/playerController.js

const { User, PlayerProfile, NJCAACollege, CoachProfile } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database.connection');

/**
 * Contrôleur pour la gestion des joueurs NJCAA avec leurs dashboards et fonctionnalités
 * 
 * CORRECTION : Toutes les méthodes référencées dans les routes sont maintenant implémentées
 * pour éviter l'erreur "callback function undefined"
 */
class PlayerController {
  /**
   * 📊 Dashboard principal du joueur - Vue d'ensemble complète
   */
  static async getDashboard(req, res) {
    try {
      const userId = req.user.id;
      
      console.log(`📊 Loading dashboard for player: ${req.user.email}`);

      // Récupération du profil complet avec relations
      const playerProfile = await PlayerProfile.findOne({
        where: { userId: userId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email', 'isActive', 'createdAt', 'lastLogin']
          },
          {
            model: NJCAACollege,
            as: 'college',
            attributes: ['id', 'name', 'state', 'region', 'isActive']
          }
        ]
      });

      if (!playerProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Player profile not found',
          code: 'PLAYER_PROFILE_NOT_FOUND'
        });
      }

      // Calcul des statistiques d'activité
      const stats = await this.calculatePlayerStats(playerProfile.id);
      
      // Activité récente (30 derniers jours)
      const recentActivity = await this.getRecentActivity(playerProfile.id);
      
      // Recommendations personnalisées
      const recommendations = await this.generatePlayerRecommendations(playerProfile);

      // Construction de la réponse dashboard
      const dashboardData = {
        profile: {
          ...playerProfile.toJSON(),
          completionPercentage: this.calculateProfileCompletion(playerProfile)
        },
        statistics: stats,
        recentActivity: recentActivity,
        recommendations: recommendations,
        lastUpdated: new Date()
      };

      console.log(`✅ Dashboard loaded successfully for player: ${req.user.email}`);

      return res.status(200).json({
        status: 'success',
        message: 'Player dashboard retrieved successfully',
        data: dashboardData
      });

    } catch (error) {
      console.error(`❌ Error loading player dashboard for ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to load player dashboard',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 👤 Profil public d'un joueur (pour les coachs)
   */
  static async getPlayerProfile(req, res) {
    try {
      const { playerId } = req.params;
      const viewerUser = req.user;

      console.log(`👁️ Player profile requested: ID ${playerId} by ${viewerUser.email}`);

      const playerProfile = await PlayerProfile.findByPk(playerId, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email', 'createdAt']
          },
          {
            model: NJCAACollege,
            as: 'college',
            attributes: ['id', 'name', 'state', 'region']
          }
        ]
      });

      if (!playerProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Player profile not found',
          code: 'PLAYER_NOT_FOUND'
        });
      }

      // Contrôles de visibilité
      const isOwnProfile = playerProfile.userId === viewerUser.id;
      const isAdmin = viewerUser.userType === 'admin';
      
      if (!isOwnProfile && !isAdmin && !playerProfile.isProfileVisible) {
        return res.status(403).json({
          status: 'error',
          message: 'This player profile is private',
          code: 'PROFILE_PRIVATE'
        });
      }

      // Enregistrement de la vue (analytics) - Si c'est un coach qui regarde
      if (!isOwnProfile && viewerUser.userType === 'coach') {
        await playerProfile.increment('profileViews');
        console.log(`📈 Profile view recorded for player ${playerId} by coach ${viewerUser.email}`);
      }

      const profileData = {
        ...playerProfile.toJSON(),
        isOwnProfile: isOwnProfile,
        canEdit: isOwnProfile || isAdmin,
        viewerType: viewerUser.userType
      };

      return res.status(200).json({
        status: 'success',
        message: 'Player profile retrieved successfully',
        data: {
          profile: profileData
        }
      });

    } catch (error) {
      console.error(`❌ Error retrieving player profile ${req.params.playerId}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve player profile',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 📈 Analytics personnelles du joueur
   */
  static async getPlayerAnalytics(req, res) {
    try {
      const userId = req.user.id;
      
      console.log(`📈 Loading analytics for player: ${req.user.email}`);

      const playerProfile = await PlayerProfile.findOne({
        where: { userId: userId }
      });

      if (!playerProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Player profile not found'
        });
      }

      // Calcul des métriques détaillées
      const analytics = {
        profileViews: {
          total: playerProfile.profileViews,
          thisMonth: await this.calculateMonthlyViews(playerProfile.id),
          thisWeek: await this.calculateWeeklyViews(playerProfile.id),
          trend: await this.calculateViewsTrend(playerProfile.id)
        },
        profileMetrics: {
          completionPercentage: this.calculateProfileCompletion(playerProfile),
          isVisible: playerProfile.isProfileVisible,
          lastUpdate: playerProfile.lastProfileUpdate,
          createdAt: playerProfile.createdAt
        },
        coachInteractions: await this.getCoachInteractions(playerProfile.id),
        recommendations: await this.generateAnalyticsRecommendations(playerProfile)
      };

      return res.status(200).json({
        status: 'success',
        message: 'Player analytics retrieved successfully',
        data: analytics
      });

    } catch (error) {
      console.error(`❌ Error loading player analytics for ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to load player analytics',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * ✏️ Mise à jour du profil joueur
   */
  static async updatePlayerProfile(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const userId = req.user.id;
      const updateData = req.body;

      console.log(`✏️ Updating profile for player: ${req.user.email}`);

      const playerProfile = await PlayerProfile.findOne({
        where: { userId: userId },
        transaction
      });

      if (!playerProfile) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Player profile not found'
        });
      }

      // Validation métier spécialisée
      if (updateData.collegeId && updateData.collegeId !== playerProfile.collegeId) {
        const college = await NJCAACollege.findByPk(updateData.collegeId, { transaction });
        
        if (!college || !college.isActive) {
          await transaction.rollback();
          return res.status(400).json({
            status: 'error',
            message: 'Selected college is not valid or inactive',
            code: 'INVALID_COLLEGE'
          });
        }
      }

      // Mise à jour du profil
      const updatedProfile = await playerProfile.update({
        ...updateData,
        lastProfileUpdate: new Date()
      }, { transaction });

      // Recalculer le statut de completion
      const newCompletionStatus = this.determineCompletionStatus(updatedProfile);
      
      if (newCompletionStatus !== updatedProfile.profileCompletionStatus) {
        await updatedProfile.update({
          profileCompletionStatus: newCompletionStatus
        }, { transaction });
      }

      await transaction.commit();

      // Récupération du profil mis à jour avec relations
      const refreshedProfile = await PlayerProfile.findOne({
        where: { userId: userId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['firstName', 'lastName', 'email']
          },
          {
            model: NJCAACollege,
            as: 'college',
            attributes: ['name', 'state', 'region']
          }
        ]
      });

      console.log(`✅ Profile updated successfully for player: ${req.user.email}`);

      return res.status(200).json({
        status: 'success',
        message: 'Player profile updated successfully',
        data: {
          profile: refreshedProfile,
          completionPercentage: this.calculateProfileCompletion(refreshedProfile)
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error(`❌ Error updating player profile for ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update player profile',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 👁️ Contrôler la visibilité du profil (public/privé)
   * NOUVELLE MÉTHODE - Corrige l'erreur "undefined callback"
   */
  static async toggleProfileVisibility(req, res) {
    try {
      const userId = req.user.id;
      const { isVisible } = req.body;

      console.log(`👁️ Toggling profile visibility for player: ${req.user.email}`);

      const playerProfile = await PlayerProfile.findOne({
        where: { userId: userId }
      });

      if (!playerProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Player profile not found'
        });
      }

      // Mise à jour de la visibilité
      await playerProfile.update({
        isProfileVisible: isVisible,
        lastProfileUpdate: new Date()
      });

      console.log(`✅ Profile visibility updated to ${isVisible ? 'public' : 'private'} for player: ${req.user.email}`);

      return res.status(200).json({
        status: 'success',
        message: `Profile is now ${isVisible ? 'public' : 'private'}`,
        data: {
          isVisible: isVisible,
          message: isVisible 
            ? 'Your profile is now visible to coaches' 
            : 'Your profile is now private'
        }
      });

    } catch (error) {
      console.error(`❌ Error toggling profile visibility for ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update profile visibility',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 🔍 Recherche de joueurs (pour les coachs)
   * NOUVELLE MÉTHODE - Corrige l'erreur "undefined callback"
   */
  static async searchPlayers(req, res) {
    try {
      const viewerUser = req.user;
      const {
        gender,
        state,
        region,
        collegeId,
        profileStatus = 'all',
        minViews = 0,
        page = 1,
        limit = 20,
        sortBy = 'profile_views',
        sortOrder = 'desc'
      } = req.query;

      console.log(`🔍 Player search initiated by ${viewerUser.userType}: ${viewerUser.email}`);

      // Construction des conditions de recherche
      const whereConditions = {
        isProfileVisible: true // Seulement les profils publics
      };

      if (gender) whereConditions.gender = gender;
      if (profileStatus !== 'all') whereConditions.profileCompletionStatus = profileStatus;
      if (minViews > 0) whereConditions.profileViews = { [Op.gte]: parseInt(minViews) };

      // Conditions pour le college
      const collegeWhereConditions = {};
      if (state) collegeWhereConditions.state = state.toUpperCase();
      if (region) collegeWhereConditions.region = region;
      if (collegeId) collegeWhereConditions.id = collegeId;

      // Recherche avec pagination
      const { count, rows: players } = await PlayerProfile.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'createdAt']
          },
          {
            model: NJCAACollege,
            as: 'college',
            where: Object.keys(collegeWhereConditions).length > 0 ? collegeWhereConditions : undefined,
            attributes: ['id', 'name', 'state', 'region']
          }
        ],
        order: [[sortBy, sortOrder.toUpperCase()]],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        distinct: true
      });

      console.log(`✅ Found ${count} players matching search criteria`);

      return res.status(200).json({
        status: 'success',
        message: 'Player search completed successfully',
        data: {
          players: players,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            totalPages: Math.ceil(count / limit)
          },
          searchCriteria: {
            gender, state, region, collegeId, profileStatus, minViews,
            sortBy, sortOrder
          }
        }
      });

    } catch (error) {
      console.error(`❌ Error in player search by ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Player search failed',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 📊 Enregistrer une vue de profil (analytics)
   * NOUVELLE MÉTHODE - Corrige l'erreur "undefined callback"
   */
  static async recordProfileView(req, res) {
    try {
      const { playerId } = req.params;
      const viewerUser = req.user;

      console.log(`📊 Recording profile view: Player ${playerId} by ${viewerUser.userType} ${viewerUser.email}`);

      const playerProfile = await PlayerProfile.findByPk(playerId);

      if (!playerProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Player profile not found'
        });
      }

      // Seulement enregistrer si ce n'est pas le joueur lui-même qui regarde
      if (playerProfile.userId !== viewerUser.id) {
        await playerProfile.increment('profileViews');
        
        console.log(`✅ Profile view recorded for player ${playerId}`);

        return res.status(200).json({
          status: 'success',
          message: 'Profile view recorded successfully',
          data: {
            playerId: playerId,
            newViewCount: playerProfile.profileViews + 1
          }
        });
      } else {
        return res.status(200).json({
          status: 'success',
          message: 'Own profile view - not recorded',
          data: {
            playerId: playerId,
            viewCount: playerProfile.profileViews
          }
        });
      }

    } catch (error) {
      console.error(`❌ Error recording profile view for player ${req.params.playerId}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to record profile view',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  // ========================
  // MÉTHODES UTILITAIRES PRIVÉES
  // ========================
  
  /**
   * Calcule le pourcentage de completion du profil
   */
  static calculateProfileCompletion(playerProfile) {
    let completedFields = 0;
    const totalFields = 8;

    if (playerProfile.gender) completedFields++;
    if (playerProfile.collegeId) completedFields++;
    if (playerProfile.user && playerProfile.user.firstName) completedFields++;
    if (playerProfile.user && playerProfile.user.lastName) completedFields++;
    if (playerProfile.user && playerProfile.user.email) completedFields++;
    
    // Champs futurs (pour l'évolution du profil)
    if (playerProfile.birthDate) completedFields++;
    if (playerProfile.phoneNumber) completedFields++;
    if (playerProfile.bio) completedFields++;

    return Math.round((completedFields / totalFields) * 100);
  }

  /**
   * Détermine le statut de completion
   */
  static determineCompletionStatus(playerProfile) {
    const completionPercentage = this.calculateProfileCompletion(playerProfile);
    
    if (completionPercentage < 50) return 'basic';
    if (completionPercentage < 80) return 'completed';
    return 'premium';
  }

  /**
   * Calcule les statistiques d'activité du joueur
   */
  static async calculatePlayerStats(playerProfileId) {
    try {
      const playerProfile = await PlayerProfile.findByPk(playerProfileId);
      
      return {
        totalViews: playerProfile.profileViews,
        profileScore: this.calculateProfileCompletion(playerProfile),
        visibility: playerProfile.isProfileVisible ? 'Public' : 'Private',
        memberSince: playerProfile.createdAt,
        lastActivity: playerProfile.lastProfileUpdate || playerProfile.updatedAt
      };
    } catch (error) {
      console.error('Error calculating player stats:', error);
      return {
        totalViews: 0,
        profileScore: 0,
        visibility: 'Private',
        memberSince: new Date(),
        lastActivity: new Date()
      };
    }
  }

  /**
   * Récupère l'activité récente du joueur
   */
  static async getRecentActivity(playerProfileId) {
    try {
      const playerProfile = await PlayerProfile.findByPk(playerProfileId);
      
      const activities = [];
      
      if (playerProfile.lastProfileUpdate) {
        activities.push({
          type: 'profile_update',
          description: 'Profile information updated',
          timestamp: playerProfile.lastProfileUpdate,
          icon: '✏️'
        });
      }
      
      activities.push({
        type: 'profile_created',
        description: 'Profile created',
        timestamp: playerProfile.createdAt,
        icon: '🎉'
      });
      
      return activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);
      
    } catch (error) {
      console.error('Error getting recent activity:', error);
      return [];
    }
  }

  /**
   * Génère des recommendations personnalisées pour le joueur
   */
  static async generatePlayerRecommendations(playerProfile) {
    const recommendations = [];
    
    const completionPercentage = this.calculateProfileCompletion(playerProfile);
    
    if (completionPercentage < 70) {
      recommendations.push({
        type: 'profile_completion',
        title: 'Complete Your Profile',
        description: 'A complete profile gets 3x more views from coaches',
        action: 'Complete profile',
        priority: 'high'
      });
    }
    
    if (!playerProfile.isProfileVisible) {
      recommendations.push({
        type: 'visibility',
        title: 'Make Your Profile Visible',
        description: 'Hidden profiles can\'t be discovered by coaches',
        action: 'Make profile public',
        priority: 'medium'
      });
    }
    
    if (playerProfile.profileViews < 10) {
      recommendations.push({
        type: 'exposure',
        title: 'Increase Your Visibility',
        description: 'Add more details to help coaches find you',
        action: 'Enhance profile',
        priority: 'medium'
      });
    }
    
    return recommendations;
  }

  // Méthodes analytiques (implémentation basique pour éviter les erreurs)
  static async calculateMonthlyViews(playerProfileId) { return 0; }
  static async calculateWeeklyViews(playerProfileId) { return 0; }
  static async calculateViewsTrend(playerProfileId) { return 'stable'; }
  static async getCoachInteractions(playerProfileId) { return []; }
  static async generateAnalyticsRecommendations(playerProfile) { return []; }
}

module.exports = PlayerController;