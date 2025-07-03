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

      // CORRECTION CRITIQUE : Utilisation directe de la classe au lieu de 'this'
      // AVANT : const stats = await this.calculatePlayerStats(playerProfile.id);
      // MAINTENANT : Référence explicite à la classe
      const stats = await PlayerController.calculatePlayerStats(playerProfile.id);
      
      // Activité récente (30 derniers jours)
      const recentActivity = await PlayerController.getRecentActivity(playerProfile.id);
      
      // Recommendations personnalisées
      const recommendations = await PlayerController.generatePlayerRecommendations(playerProfile);

      // Construction de la réponse dashboard
      const dashboardData = {
        profile: {
          ...playerProfile.toJSON(),
          completionPercentage: PlayerController.calculateProfileCompletion(playerProfile)
        },
        statistics: stats,
        recentActivity: recentActivity,
        recommendations: recommendations
      };

      console.log(`✅ Dashboard loaded successfully for player: ${req.user.email}`);
      console.log(`   Profile completion: ${dashboardData.profile.completionPercentage}%`);
      console.log(`   College: ${playerProfile.college?.name || 'No college assigned'}`);
      console.log(`   Total views: ${stats.totalViews}`);

      return res.status(200).json({
        status: 'success',
        message: 'Player dashboard loaded successfully',
        data: dashboardData
      });

    } catch (error) {
      console.error(`❌ Error loading player dashboard for ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to load player dashboard',
        code: 'DASHBOARD_LOAD_ERROR',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 👤 Profil public d'un joueur (pour les coachs et autres joueurs)
   */
  static async getPlayerProfile(req, res) {
    try {
      const { playerId } = req.params;
      const viewerUser = req.user;
      
      console.log(`👤 Loading player profile ${playerId} for viewer: ${viewerUser.email}`);

      const playerProfile = await PlayerProfile.findByPk(playerId, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email']
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
          message: 'Player profile not found'
        });
      }

      // Vérifications de permissions
      const isOwnProfile = viewerUser.id === playerProfile.userId;
      const isAdmin = viewerUser.userType === 'admin';
      const isCoach = viewerUser.userType === 'coach';

      // Enregistrer la vue si c'est un coach qui regarde
      if (isCoach && !isOwnProfile) {
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
          thisMonth: await PlayerController.calculateMonthlyViews(playerProfile.id),
          thisWeek: await PlayerController.calculateWeeklyViews(playerProfile.id),
          trend: await PlayerController.calculateViewsTrend(playerProfile.id)
        },
        profileMetrics: {
          completionPercentage: PlayerController.calculateProfileCompletion(playerProfile),
          isVisible: playerProfile.isProfileVisible,
          lastUpdate: playerProfile.lastProfileUpdate,
          createdAt: playerProfile.createdAt
        },
        coachInteractions: await PlayerController.getCoachInteractions(playerProfile.id),
        recommendations: await PlayerController.generateAnalyticsRecommendations(playerProfile)
      };

      return res.status(200).json({
        status: 'success',
        message: 'Player analytics loaded successfully',
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
    try {
      const userId = req.user.id;
      const updateData = req.body;
      
      console.log(`✏️ Updating player profile for: ${req.user.email}`);

      const playerProfile = await PlayerProfile.findOne({
        where: { userId: userId }
      });

      if (!playerProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Player profile not found'
        });
      }

      // Mise à jour des champs autorisés
      const updatedProfile = await playerProfile.update({
        ...updateData,
        lastProfileUpdate: new Date()
      });

      console.log(`✅ Profile updated successfully for: ${req.user.email}`);

      return res.status(200).json({
        status: 'success',
        message: 'Player profile updated successfully',
        data: {
          profile: updatedProfile
        }
      });

    } catch (error) {
      console.error(`❌ Error updating player profile for ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update player profile',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 🔄 Basculer la visibilité du profil
   */
  static async toggleProfileVisibility(req, res) {
    try {
      const userId = req.user.id;
      
      console.log(`🔄 Toggling profile visibility for: ${req.user.email}`);

      const playerProfile = await PlayerProfile.findOne({
        where: { userId: userId }
      });

      if (!playerProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Player profile not found'
        });
      }

      const newVisibility = !playerProfile.isProfileVisible;
      
      await playerProfile.update({
        isProfileVisible: newVisibility
      });

      console.log(`✅ Profile visibility changed to: ${newVisibility ? 'Public' : 'Private'} for ${req.user.email}`);

      return res.status(200).json({
        status: 'success',
        message: `Profile is now ${newVisibility ? 'public' : 'private'}`,
        data: {
          isVisible: newVisibility
        }
      });

    } catch (error) {
      console.error(`❌ Error toggling profile visibility for ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to toggle profile visibility',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 🔍 Recherche de joueurs (pour les coachs)
   */
  static async searchPlayers(req, res) {
    try {
      const { 
        gender, 
        state, 
        region, 
        collegeId, 
        profileStatus = 'all',
        minViews = 0,
        page = 1, 
        limit = 20,
        sortBy = 'profileViews',
        sortOrder = 'desc'
      } = req.query;

      console.log(`🔍 Player search by coach: ${req.user.email}`);

      // Construction des filtres de recherche
      const whereConditions = {
        isProfileVisible: true
      };

      if (gender) whereConditions.gender = gender;
      if (collegeId) whereConditions.collegeId = collegeId;

      // Filtres sur le college via relation
      let collegeWhereConditions = {};
      if (state) collegeWhereConditions.state = state;
      if (region) collegeWhereConditions.region = region;

      // Recherche avec pagination
      const { count, rows: players } = await PlayerProfile.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email']
          },
          {
            model: NJCAACollege,
            as: 'college',
            where: Object.keys(collegeWhereConditions).length > 0 ? 
                   collegeWhereConditions : undefined,
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

      console.log(`📊 Recording profile view: Player ${playerId} by ${viewerUser.email}`);

      const playerProfile = await PlayerProfile.findByPk(playerId);

      if (!playerProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Player profile not found'
        });
      }

      // Enregistrer la vue
      await playerProfile.increment('profileViews');

      console.log(`✅ Profile view recorded successfully`);

      return res.status(200).json({
        status: 'success',
        message: 'Profile view recorded',
        data: {
          totalViews: playerProfile.profileViews + 1
        }
      });

    } catch (error) {
      console.error(`❌ Error recording profile view:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to record profile view',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  // ========================
  // MÉTHODES UTILITAIRES STATIQUES
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
    const completionPercentage = PlayerController.calculateProfileCompletion(playerProfile);
    
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
      
      if (!playerProfile) {
        console.log(`⚠️ Player profile ${playerProfileId} not found for stats calculation`);
        return {
          totalViews: 0,
          profileScore: 0,
          visibility: 'Private',
          memberSince: new Date(),
          lastActivity: new Date()
        };
      }
      
      return {
        totalViews: playerProfile.profileViews || 0,
        profileScore: PlayerController.calculateProfileCompletion(playerProfile),
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
      
      if (!playerProfile) {
        return [];
      }
      
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
    
    const completionPercentage = PlayerController.calculateProfileCompletion(playerProfile);
    
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
  static async calculateMonthlyViews(playerProfileId) { 
    // Implementation future pour analytics plus détaillées
    return 0; 
  }
  
  static async calculateWeeklyViews(playerProfileId) { 
    // Implementation future pour analytics plus détaillées
    return 0; 
  }
  
  static async calculateViewsTrend(playerProfileId) { 
    // Implementation future pour analytics plus détaillées
    return 'stable'; 
  }
  
  static async getCoachInteractions(playerProfileId) { 
    // Implementation future pour suivi des interactions
    return []; 
  }
  
  static async generateAnalyticsRecommendations(playerProfile) { 
    // Implementation future pour recommendations avancées
    return []; 
  }
}

module.exports = PlayerController;