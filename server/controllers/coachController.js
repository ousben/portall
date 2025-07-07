// portall/server/controllers/coachController.js

const { User, CoachProfile, PlayerProfile, NCAACollege, CoachFavorite } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database.connection');

/**
 * 🏟️ Contrôleur pour la gestion des coachs NCAA/NAIA avec leurs fonctionnalités complètes
 * 
 * ARCHITECTURE MÉTIER : Ce contrôleur gère le workflow complet des coachs NCAA/NAIA
 * qui recherchent et recrutent des joueurs NJCAA. Contrairement aux coachs NJCAA
 * qui évaluent leurs propres joueurs, ces coachs paient des abonnements pour
 * accéder à une base de données de talents.
 * 
 * 🎯 Fonctionnalités principales :
 * 1. Dashboard avec métriques de recrutement
 * 2. Système de favoris pour sauvegarder les joueurs intéressants
 * 3. Recherches sauvegardées avec critères personnalisés
 * 4. Analytics pour optimiser les stratégies de recrutement
 * 5. Gestion du profil personnel
 * 
 * 💡 Concept pédagogique : Ce contrôleur illustre la différence entre
 * "consommateurs de données" (coachs NCAA/NAIA) et "producteurs de données"
 * (coachs NJCAA). Chaque type a son propre workflow optimisé.
 */
class CoachController {
  /**
   * 📊 Dashboard principal du coach NCAA/NAIA
   * 
   * Cette méthode fournit une vue d'ensemble de l'activité de recrutement
   * du coach avec des métriques clés et des recommandations personnalisées.
   * 
   * 🎯 Données retournées :
   * - Profil complet du coach avec college
   * - Statistiques d'activité (recherches, favoris, vues)
   * - Joueurs favoris récents
   * - Recommandations d'optimisation
   * - Tendances et analytics
   */
  static async getDashboard(req, res) {
    try {
      const userId = req.user.id;
      
      console.log(`📊 Loading coach dashboard for: ${req.user.email}`);

      // Récupération du profil complet avec college
      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email', 'createdAt']
          },
          {
            model: NCAACollege,
            as: 'college',
            attributes: ['id', 'name', 'state', 'division', 'isActive']
          }
        ]
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found',
          code: 'COACH_PROFILE_NOT_FOUND'
        });
      }

      // 📈 Calculer les métriques d'activité
      const activityMetrics = {
        totalSearches: coachProfile.totalSearches || 0,
        savedSearches: (coachProfile.savedSearches || []).length,
        totalFavorites: await CoachController.getFavoritesSummary(coachProfile.id),
        profileViews: coachProfile.profileViews || 0,
        lastActivity: coachProfile.lastSearchDate || coachProfile.updatedAt
      };

      // 🎯 Générer des recommandations personnalisées
      const recommendations = await CoachController.generateCoachRecommendations(coachProfile);

      // ⭐ Récupérer les favoris récents (5 derniers)
      const recentFavorites = await CoachController.getRecentFavorites(coachProfile.id, 5);

      console.log(`✅ Dashboard loaded successfully for coach ${userId}`);

      return res.json({
        status: 'success',
        data: {
          coach: {
            profile: coachProfile.toJSON(),
            college: coachProfile.college,
            user: coachProfile.user
          },
          metrics: activityMetrics,
          recentFavorites: recentFavorites,
          recommendations: recommendations,
          metadata: {
            lastUpdated: new Date(),
            dashboardVersion: '2.0',
            isSubscriptionActive: true // TODO: Vérifier l'abonnement Stripe
          }
        }
      });

    } catch (error) {
      console.error('Coach dashboard error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to load dashboard',
        code: 'DASHBOARD_ERROR'
      });
    }
  }

  /**
   * 👤 Profil public d'un coach spécifique
   * 
   * Cette méthode permet de consulter le profil d'un coach.
   * Utilisée par les admins et dans les fonctionnalités de networking.
   */
  static async getCoachProfile(req, res) {
    try {
      const { coachId } = req.params;
      
      console.log(`👤 Loading coach profile: ${coachId}`);

      const coachProfile = await CoachProfile.findByPk(coachId, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email', 'createdAt']
          },
          {
            model: NCAACollege,
            as: 'college',
            attributes: ['id', 'name', 'state', 'division']
          }
        ]
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found',
          code: 'COACH_NOT_FOUND'
        });
      }

      // Données publiques seulement
      const publicProfile = {
        id: coachProfile.id,
        position: coachProfile.position,
        teamSport: coachProfile.teamSport,
        division: coachProfile.division,
        college: coachProfile.college,
        user: {
          firstName: coachProfile.user.firstName,
          lastName: coachProfile.user.lastName,
          joinedDate: coachProfile.user.createdAt
        },
        totalSearches: coachProfile.totalSearches,
        memberSince: coachProfile.createdAt
      };

      return res.json({
        status: 'success',
        data: {
          coach: publicProfile
        }
      });

    } catch (error) {
      console.error('Get coach profile error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to load coach profile',
        code: 'GET_PROFILE_ERROR'
      });
    }
  }

  /**
   * 📈 Analytics détaillées du coach
   * 
   * Cette méthode fournit des analytics avancées pour aider le coach
   * à optimiser ses stratégies de recrutement.
   */
  static async getCoachAnalytics(req, res) {
    try {
      const userId = req.user.id;
      
      console.log(`📈 Loading analytics for coach: ${req.user.email}`);

      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found',
          code: 'COACH_PROFILE_NOT_FOUND'
        });
      }

      // 📊 Calculer les analytics détaillées
      const analytics = {
        searchMetrics: {
          totalSearches: coachProfile.totalSearches || 0,
          weeklyAverage: await CoachController.calculateWeeklySearchAverage(coachProfile.id),
          mostUsedFilters: await CoachController.analyzeMostUsedFilters(coachProfile.savedSearches || []),
          savedSearches: (coachProfile.savedSearches || []).length
        },
        favoritesMetrics: await CoachController.calculateFavoritesMetrics(coachProfile.id),
        recruitingEfficiency: CoachController.calculateRecruitingEfficiency(
          { totalSearches: coachProfile.totalSearches || 0 },
          await CoachController.calculateFavoritesMetrics(coachProfile.id)
        ),
        engagementScore: await CoachController.calculateEngagementScore(coachProfile.id),
        activityPatterns: await CoachController.analyzeActivityPatterns(coachProfile.id),
        recommendations: await CoachController.generateOptimizationRecommendations(coachProfile)
      };

      return res.status(200).json({
        status: 'success',
        message: 'Coach analytics loaded successfully',
        data: analytics
      });

    } catch (error) {
      console.error(`❌ Error loading coach analytics for ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to load coach analytics',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * ✏️ Mise à jour du profil coach
   * 
   * Permet au coach de modifier certains champs de son profil.
   * Certains champs nécessitent une validation admin.
   */
  static async updateCoachProfile(req, res) {
    try {
      const userId = req.user.id;
      const updateData = req.body;
      
      console.log(`✏️ Updating coach profile for: ${req.user.email}`);

      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found',
          code: 'COACH_PROFILE_NOT_FOUND'
        });
      }

      // 🔒 Champs modifiables sans validation admin
      const allowedFields = ['phoneNumber', 'bio', 'recruitingPreferences'];
      const filteredData = {};
      
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      });

      // Mise à jour avec timestamp
      const updatedProfile = await coachProfile.update({
        ...filteredData,
        lastProfileUpdate: new Date()
      });

      console.log(`✅ Profile updated successfully for: ${req.user.email}`);

      return res.status(200).json({
        status: 'success',
        message: 'Coach profile updated successfully',
        data: {
          profile: updatedProfile.toJSON(),
          updatedFields: Object.keys(filteredData)
        }
      });

    } catch (error) {
      console.error(`❌ Error updating coach profile for ${req.user.email}:`, error);
      
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
          status: 'error',
          message: 'Validation error in profile data',
          errors: error.errors.map(err => ({
            field: err.path,
            message: err.message
          }))
        });
      }
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update coach profile',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * ⭐ Récupérer la liste des joueurs favoris
   * 
   * Cette méthode retourne tous les joueurs sauvegardés par le coach
   * avec leurs informations détaillées et notes personnelles.
   */
  static async getFavoriteProfiles(req, res) {
    try {
      const userId = req.user.id;
      
      console.log(`⭐ Loading favorites for coach: ${req.user.email}`);

      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found',
          code: 'COACH_PROFILE_NOT_FOUND'
        });
      }

      // Récupérer les favoris depuis le champ JSON
      const favoriteIds = (coachProfile.favoriteProfiles || []).map(fav => fav.playerId);
      
      if (favoriteIds.length === 0) {
        return res.json({
          status: 'success',
          data: {
            favorites: [],
            total: 0,
            message: 'No favorite players yet'
          }
        });
      }

      // Récupérer les profils complets des joueurs favoris
      const favoriteProfiles = await PlayerProfile.findAll({
        where: { id: { [Op.in]: favoriteIds } },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email']
          },
          {
            model: NCAACollege,
            as: 'college',
            attributes: ['id', 'name', 'state']
          }
        ]
      });

      // Enrichir avec les données de favoris (notes, priorité, etc.)
      const enrichedFavorites = favoriteProfiles.map(player => {
        const favoriteData = coachProfile.favoriteProfiles.find(fav => fav.playerId === player.id);
        return {
          ...player.toJSON(),
          favoriteInfo: favoriteData || {}
        };
      });

      return res.json({
        status: 'success',
        data: {
          favorites: enrichedFavorites,
          total: enrichedFavorites.length,
          summary: await CoachController.getFavoritesSummary(coachProfile.id)
        }
      });

    } catch (error) {
      console.error(`❌ Error loading favorites for coach ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to load favorite profiles',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * ⭐ Ajouter un joueur aux favoris
   * 
   * Cette méthode permet au coach de sauvegarder un joueur intéressant
   * avec des notes personnelles et un niveau de priorité.
   */
  static async addToFavorites(req, res) {
    try {
      const { playerId } = req.params;
      const userId = req.user.id;
      const { priority = 'medium', notes = '', status = 'interested' } = req.body;

      console.log(`⭐ Adding player ${playerId} to favorites for coach: ${req.user.email}`);

      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found',
          code: 'COACH_PROFILE_NOT_FOUND'
        });
      }

      // Vérifier que le joueur existe et est visible
      const playerProfile = await PlayerProfile.findOne({
        where: { 
          id: playerId,
          isProfileVisible: true
        },
        include: [{
          model: User,
          as: 'user',
          where: { isActive: true }
        }]
      });

      if (!playerProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Player not found or not available',
          code: 'PLAYER_NOT_FOUND'
        });
      }

      // Gérer les favoris dans le champ JSON
      const currentFavorites = coachProfile.favoriteProfiles || [];
      
      // Vérifier si déjà en favoris
      const existingFavoriteIndex = currentFavorites.findIndex(fav => fav.playerId == playerId);
      
      if (existingFavoriteIndex >= 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Player already in favorites',
          code: 'ALREADY_FAVORITE'
        });
      }

      // Créer le nouvel objet favori
      const newFavorite = {
        playerId: parseInt(playerId),
        priority: priority,
        notes: notes,
        status: status,
        addedAt: new Date(),
        lastUpdated: new Date(),
        playerName: `${playerProfile.user.firstName} ${playerProfile.user.lastName}`
      };

      // Ajouter aux favoris
      currentFavorites.push(newFavorite);

      // Sauvegarder en base
      await coachProfile.update({
        favoriteProfiles: currentFavorites
      });

      console.log(`✅ Player ${playerId} added to favorites for coach ${req.user.email}`);

      return res.status(201).json({
        status: 'success',
        message: 'Player added to favorites successfully',
        data: {
          favorite: newFavorite,
          totalFavorites: currentFavorites.length,
          player: {
            id: playerProfile.id,
            name: `${playerProfile.user.firstName} ${playerProfile.user.lastName}`,
            position: playerProfile.position,
            college: playerProfile.college?.name
          }
        }
      });

    } catch (error) {
      console.error(`❌ Error adding to favorites for coach ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to add player to favorites',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 🗑️ Retirer un joueur des favoris
   * 
   * Cette méthode permet au coach de supprimer un joueur de sa liste de favoris.
   */
  static async removeFromFavorites(req, res) {
    try {
      const { playerId } = req.params;
      const userId = req.user.id;

      console.log(`🗑️ Removing player ${playerId} from favorites for coach: ${req.user.email}`);

      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found',
          code: 'COACH_PROFILE_NOT_FOUND'
        });
      }

      // Récupérer les favoris actuels
      const currentFavorites = coachProfile.favoriteProfiles || [];
      
      // Trouver l'index du favori à supprimer
      const favoriteIndex = currentFavorites.findIndex(fav => fav.playerId == playerId);
      
      if (favoriteIndex === -1) {
        return res.status(404).json({
          status: 'error',
          message: 'Player not found in favorites',
          code: 'NOT_IN_FAVORITES'
        });
      }

      // Supprimer le favori
      const removedFavorite = currentFavorites.splice(favoriteIndex, 1)[0];

      // Sauvegarder en base
      await coachProfile.update({
        favoriteProfiles: currentFavorites
      });

      console.log(`✅ Player ${playerId} removed from favorites for coach ${req.user.email}`);

      return res.json({
        status: 'success',
        message: 'Player removed from favorites successfully',
        data: {
          removedFavorite: removedFavorite,
          totalFavorites: currentFavorites.length
        }
      });

    } catch (error) {
      console.error(`❌ Error removing from favorites for coach ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to remove player from favorites',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * ✏️ Mettre à jour les informations d'un favori
   * 
   * Cette méthode permet au coach de modifier ses notes, la priorité
   * ou le statut d'un joueur dans ses favoris.
   */
  static async updateFavoriteStatus(req, res) {
    try {
      const { playerId } = req.params;
      const userId = req.user.id;
      const { priority, notes, status } = req.body;

      console.log(`✏️ Updating favorite status for player ${playerId} by coach: ${req.user.email}`);

      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found',
          code: 'COACH_PROFILE_NOT_FOUND'
        });
      }

      // Récupérer les favoris actuels
      const currentFavorites = coachProfile.favoriteProfiles || [];
      
      // Trouver le favori à mettre à jour
      const favoriteIndex = currentFavorites.findIndex(fav => fav.playerId == playerId);
      
      if (favoriteIndex === -1) {
        return res.status(404).json({
          status: 'error',
          message: 'Player not found in favorites',
          code: 'NOT_IN_FAVORITES'
        });
      }

      // Mettre à jour les champs fournis
      const updatedFavorite = { ...currentFavorites[favoriteIndex] };
      
      if (priority !== undefined) updatedFavorite.priority = priority;
      if (notes !== undefined) updatedFavorite.notes = notes;
      if (status !== undefined) updatedFavorite.status = status;
      updatedFavorite.lastUpdated = new Date();

      // Remplacer dans le tableau
      currentFavorites[favoriteIndex] = updatedFavorite;

      // Sauvegarder en base
      await coachProfile.update({
        favoriteProfiles: currentFavorites
      });

      console.log(`✅ Favorite status updated for player ${playerId} by coach ${req.user.email}`);

      return res.json({
        status: 'success',
        message: 'Favorite status updated successfully',
        data: {
          updatedFavorite: updatedFavorite
        }
      });

    } catch (error) {
      console.error(`❌ Error updating favorite status for coach ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update favorite status',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 💾 Récupérer les recherches sauvegardées
   * 
   * Cette méthode retourne toutes les recherches que le coach a sauvegardées
   * pour un accès rapide à ses critères de recrutement favoris.
   */
  static async getSavedSearches(req, res) {
    try {
      const userId = req.user.id;
      
      console.log(`💾 Loading saved searches for coach: ${req.user.email}`);

      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found',
          code: 'COACH_PROFILE_NOT_FOUND'
        });
      }

      const savedSearches = coachProfile.savedSearches || [];

      return res.json({
        status: 'success',
        data: {
          searches: savedSearches,
          total: savedSearches.length,
          lastCreated: savedSearches.length > 0 ? 
            Math.max(...savedSearches.map(s => new Date(s.createdAt).getTime())) : null
        }
      });

    } catch (error) {
      console.error(`❌ Error loading saved searches for coach ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to load saved searches',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 💾 Sauvegarder une nouvelle recherche
   * 
   * Cette méthode permet au coach de sauvegarder ses critères de recherche
   * pour pouvoir les réutiliser facilement plus tard.
   */
  static async saveSearch(req, res) {
    try {
      const userId = req.user.id;
      const { name, criteria, description = '' } = req.body;

      console.log(`💾 Saving search for coach: ${req.user.email} - ${name}`);

      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found',
          code: 'COACH_PROFILE_NOT_FOUND'
        });
      }

      const currentSearches = coachProfile.savedSearches || [];

      // Vérifier que le nom n'existe pas déjà
      if (currentSearches.some(search => search.name === name)) {
        return res.status(400).json({
          status: 'error',
          message: 'A search with this name already exists',
          code: 'SEARCH_NAME_EXISTS'
        });
      }

      // Créer la nouvelle recherche
      const newSearch = {
        id: Date.now().toString(), // ID simple basé sur timestamp
        name: name,
        criteria: criteria,
        description: description,
        createdAt: new Date(),
        lastUsed: new Date(),
        usageCount: 0
      };

      // Ajouter aux recherches sauvegardées
      currentSearches.push(newSearch);

      // Limite de 10 recherches sauvegardées par coach
      if (currentSearches.length > 10) {
        currentSearches.shift(); // Supprimer la plus ancienne
      }

      // Sauvegarder en base
      await coachProfile.update({
        savedSearches: currentSearches,
        totalSearches: (coachProfile.totalSearches || 0) + 1
      });

      console.log(`✅ Search saved successfully for coach ${req.user.email}: ${name}`);

      return res.status(201).json({
        status: 'success',
        message: 'Search saved successfully',
        data: {
          search: newSearch,
          totalSavedSearches: currentSearches.length
        }
      });

    } catch (error) {
      console.error(`❌ Error saving search for coach ${req.user.email}:`, error);
      
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
          status: 'error',
          message: 'Validation error in search data',
          errors: error.errors.map(err => ({
            field: err.path,
            message: err.message
          }))
        });
      }
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to save search',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 🗑️ Supprimer une recherche sauvegardée
   * 
   * Cette méthode permet au coach de supprimer une recherche sauvegardée
   * qu'il n'utilise plus.
   */
  static async deleteSavedSearch(req, res) {
    try {
      const { searchId } = req.params;
      const userId = req.user.id;

      console.log(`🗑️ Deleting saved search ${searchId} for coach: ${req.user.email}`);

      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found',
          code: 'COACH_PROFILE_NOT_FOUND'
        });
      }

      const currentSearches = coachProfile.savedSearches || [];
      
      // Trouver l'index de la recherche à supprimer
      const searchIndex = currentSearches.findIndex(search => search.id === searchId);
      
      if (searchIndex === -1) {
        return res.status(404).json({
          status: 'error',
          message: 'Saved search not found',
          code: 'SEARCH_NOT_FOUND'
        });
      }

      // Supprimer la recherche
      const deletedSearch = currentSearches.splice(searchIndex, 1)[0];

      // Sauvegarder en base
      await coachProfile.update({
        savedSearches: currentSearches
      });

      console.log(`✅ Search deleted successfully for coach ${req.user.email}: ${deletedSearch.name}`);

      return res.json({
        status: 'success',
        message: 'Saved search deleted successfully',
        data: {
          deletedSearch: deletedSearch,
          remainingSearches: currentSearches.length
        }
      });

    } catch (error) {
      console.error(`❌ Error deleting search for coach ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to delete saved search',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  // ========================
  // 🛠️ MÉTHODES UTILITAIRES ET ANALYTICS
  // ========================

  /**
   * 🎯 Générer des recommandations personnalisées pour le coach
   */
  static async generateCoachRecommendations(coachProfile) {
    const recommendations = [];
    
    // Recommandation pour compléter le profil
    const profileCompletion = CoachController.calculateProfileCompletion(coachProfile);
    if (profileCompletion < 80) {
      recommendations.push({
        type: 'profile_completion',
        title: 'Complete Your Profile',
        description: 'A complete profile builds trust with potential recruits',
        action: 'Complete profile',
        priority: 'high'
      });
    }
    
    // Recommandation pour augmenter l'activité de recherche
    if ((coachProfile.totalSearches || 0) < 5) {
      recommendations.push({
        type: 'search_activity',
        title: 'Start Searching for Players',
        description: 'Use our advanced search to find players that match your needs',
        action: 'Start searching',
        priority: 'medium'
      });
    }

    // Recommandation pour diversifier les recherches
    const savedSearches = coachProfile.savedSearches || [];
    if (savedSearches.length < 3) {
      recommendations.push({
        type: 'save_searches',
        title: 'Save Your Search Criteria',
        description: 'Save time by storing your most used search filters',
        action: 'Save searches',
        priority: 'low'
      });
    }

    return recommendations;
  }

  /**
   * 📊 Calculer le pourcentage de complétion du profil
   */
  static calculateProfileCompletion(coachProfile) {
    const requiredFields = ['position', 'phoneNumber', 'collegeId', 'division', 'teamSport'];
    const optionalFields = ['bio', 'recruitingPreferences'];
    
    let completed = 0;
    const total = requiredFields.length + optionalFields.length;
    
    requiredFields.forEach(field => {
      if (coachProfile[field]) completed++;
    });
    
    optionalFields.forEach(field => {
      if (coachProfile[field]) completed++;
    });
    
    return Math.round((completed / total) * 100);
  }

  /**
   * ⭐ Récupérer les favoris récents
   */
  static async getRecentFavorites(coachProfileId, limit = 5) {
    try {
      const coachProfile = await CoachProfile.findByPk(coachProfileId);
      if (!coachProfile) return [];
      
      const favorites = coachProfile.favoriteProfiles || [];
      
      // Trier par date d'ajout et prendre les plus récents
      return favorites
        .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
        .slice(0, limit);
      
    } catch (error) {
      console.error('Error getting recent favorites:', error);
      return [];
    }
  }

  /**
   * 📈 Résumé des favoris
   */
  static async getFavoritesSummary(coachProfileId) {
    try {
      const coachProfile = await CoachProfile.findByPk(coachProfileId);
      if (!coachProfile) {
        return {
          total: 0,
          byPriority: { high: 0, medium: 0, low: 0 },
          byStatus: { interested: 0, contacted: 0, evaluating: 0 }
        };
      }
      
      const favorites = coachProfile.favoriteProfiles || [];
      
      const summary = {
        total: favorites.length,
        byPriority: { high: 0, medium: 0, low: 0 },
        byStatus: { interested: 0, contacted: 0, evaluating: 0 }
      };
      
      favorites.forEach(fav => {
        if (summary.byPriority[fav.priority]) {
          summary.byPriority[fav.priority]++;
        }
        if (summary.byStatus[fav.status]) {
          summary.byStatus[fav.status]++;
        }
      });
      
      return summary;
    } catch (error) {
      console.error('Error calculating favorites summary:', error);
      return {
        total: 0,
        byPriority: { high: 0, medium: 0, low: 0 },
        byStatus: { interested: 0, contacted: 0, evaluating: 0 }
      };
    }
  }

  // 📊 Méthodes analytics (implémentation basique pour éviter les erreurs)
  static async calculateWeeklySearchAverage(coachProfileId) { 
    // Implementation future pour analytics plus détaillées
    return 0; 
  }
  
  static async analyzeMostUsedFilters(savedSearches) { 
    // Implementation future pour analytics plus détaillées
    return []; 
  }
  
  static async calculateFavoritesMetrics(coachProfileId) { 
    // Implementation future pour analytics plus détaillées
    return { total: 0, thisWeek: 0, thisMonth: 0 }; 
  }
  
  static async analyzeActivityPatterns(coachProfileId) { 
    // Implementation future pour analytics plus détaillées
    return {}; 
  }
  
  static async generateOptimizationRecommendations(coachProfile) { 
    // Implementation future pour recommendations avancées
    return []; 
  }
  
  static calculateRecruitingEfficiency(searchMetrics, favoritesMetrics) { 
    // Implementation future pour calcul d'efficacité
    return 0; 
  }
  
  static async calculateEngagementScore(coachProfileId) { 
    // Implementation future pour score d'engagement
    return 0; 
  }
}

module.exports = CoachController;