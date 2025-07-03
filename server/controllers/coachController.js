// portall/server/controllers/coachController.js

const { User, CoachProfile, PlayerProfile, NCAACollege, NJCAACollege } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database.connection');

/**
 * Contrôleur pour la gestion des coachs NCAA/NAIA avec dashboards et fonctionnalités de recrutement
 * 
 * Ce contrôleur est plus complexe que PlayerController car les coachs ont des besoins métier
 * sophistiqués : recherche de talents, gestion de favoris, analytics de recrutement, etc.
 * 
 * Analogie métier : Si PlayerController gère un "casier d'athlète", CoachController gère
 * un "bureau de recrutement professionnel" avec des outils spécialisés pour découvrir,
 * évaluer, organiser et suivre les prospects.
 * 
 * Architecture suivie : Même patterns que votre AuthController et AdminController
 * - Try-catch systématique avec logging détaillé
 * - Transactions pour les opérations critiques
 * - Format de réponse standardisé
 * - Validation des permissions et ownership
 * - Gestion d'erreurs contextuelle
 */
class CoachController {
  /**
   * 📊 Dashboard principal du coach - Centre de commandement du recrutement
   */
  static async getDashboard(req, res) {
    try {
      const userId = req.user.id;
      
      console.log(`📊 Loading coach dashboard for: ${req.user.email}`);

      // Récupération du profil complet avec relations
      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email', 'isActive', 'createdAt', 'lastLogin']
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

      // CORRECTION : Utilisation directe de la classe au lieu de 'this'
      const recentFavorites = await CoachController.getRecentFavorites(coachProfile.id, 5);
      const topSavedSearches = await CoachController.getTopSavedSearches(coachProfile.id, 3);
      const recruitingStats = await CoachController.calculateRecruitingStats(coachProfile.id);
      const recentActivity = await CoachController.getCoachRecentActivity(coachProfile.id);
      const recommendations = await CoachController.generateCoachRecommendations(coachProfile);

      // Construction de la réponse dashboard complète
      const dashboardData = {
        profile: {
          ...coachProfile.toJSON(),
          profileCompleteness: CoachController.calculateCoachProfileCompleteness(coachProfile)
        },
        recruiting: {
          recentFavorites: recentFavorites,
          savedSearches: topSavedSearches,
          statistics: recruitingStats
        },
        activity: recentActivity,
        recommendations: recommendations,
        quickActions: CoachController.generateQuickActions(coachProfile),
        lastUpdated: new Date()
      };

      console.log(`✅ Coach dashboard loaded successfully for: ${req.user.email}`);
      console.log(`   College: ${coachProfile.college?.name || 'No college assigned'}`);
      console.log(`   Position: ${coachProfile.position}`);
      console.log(`   Division: ${coachProfile.division}`);
      console.log(`   Total favorites: ${recruitingStats.totalFavorites || 0}`);

      return res.status(200).json({
        status: 'success',
        message: 'Coach dashboard retrieved successfully',
        data: dashboardData
      });

    } catch (error) {
      console.error(`❌ Error loading coach dashboard for ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to load coach dashboard',
        code: 'COACH_DASHBOARD_ERROR',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 👤 Profil public d'un coach (pour joueurs et autres coachs)
   */
  static async getCoachProfile(req, res) {
    try {
      const { coachId } = req.params;
      const viewerUser = req.user;
      
      console.log(`👤 Loading coach profile ${coachId} for viewer: ${viewerUser.email}`);

      const coachProfile = await CoachProfile.findByPk(coachId, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email']
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
          message: 'Coach profile not found'
        });
      }

      // Vérifications de permissions
      const isOwnProfile = viewerUser.id === coachProfile.userId;
      const isAdmin = viewerUser.userType === 'admin';

      const profileData = {
        ...coachProfile.toJSON(),
        isOwnProfile: isOwnProfile,
        canEdit: isOwnProfile || isAdmin,
        viewerType: viewerUser.userType
      };

      return res.status(200).json({
        status: 'success',
        message: 'Coach profile retrieved successfully',
        data: {
          profile: profileData
        }
      });

    } catch (error) {
      console.error(`❌ Error retrieving coach profile ${req.params.coachId}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve coach profile',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 📈 Analytics détaillées du coach
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
          message: 'Coach profile not found'
        });
      }

      // Calcul des métriques détaillées de recrutement
      const analytics = {
        searchMetrics: {
          totalSearches: coachProfile.totalSearches || 0,
          weeklyAverage: await CoachController.calculateWeeklySearchAverage(coachProfile.id),
          mostUsedFilters: await CoachController.analyzeMostUsedFilters(coachProfile.savedSearches || [])
        },
        favoritesMetrics: await CoachController.calculateFavoritesMetrics(coachProfile.id),
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
          message: 'Coach profile not found'
        });
      }

      // Mise à jour des champs autorisés
      const updatedProfile = await coachProfile.update({
        ...updateData,
        lastProfileUpdate: new Date()
      });

      console.log(`✅ Profile updated successfully for: ${req.user.email}`);

      return res.status(200).json({
        status: 'success',
        message: 'Coach profile updated successfully',
        data: {
          profile: updatedProfile
        }
      });

    } catch (error) {
      console.error(`❌ Error updating coach profile for ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update coach profile',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * ⭐ Ajouter un joueur aux favoris
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
          message: 'Coach profile not found'
        });
      }

      // Vérifier que le joueur existe
      const playerProfile = await PlayerProfile.findByPk(playerId);
      if (!playerProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Player not found'
        });
      }

      // Gestion des favoris dans un champ JSON
      const currentFavorites = coachProfile.favoriteProfiles || [];
      
      // Vérifier si déjà en favoris
      const existingFavoriteIndex = currentFavorites.findIndex(fav => fav.playerId == playerId);
      
      if (existingFavoriteIndex >= 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Player already in favorites'
        });
      }

      // Ajouter aux favoris
      const newFavorite = {
        playerId: parseInt(playerId),
        priority: priority,
        notes: notes,
        status: status,
        addedAt: new Date(),
        lastUpdated: new Date()
      };

      currentFavorites.push(newFavorite);

      await coachProfile.update({
        favoriteProfiles: currentFavorites
      });

      console.log(`✅ Player ${playerId} added to favorites for coach ${req.user.email}`);

      return res.status(200).json({
        status: 'success',
        message: 'Player added to favorites successfully',
        data: {
          favorite: newFavorite,
          totalFavorites: currentFavorites.length
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
          message: 'Coach profile not found'
        });
      }

      const currentFavorites = coachProfile.favoriteProfiles || [];
      const updatedFavorites = currentFavorites.filter(fav => fav.playerId != playerId);

      if (currentFavorites.length === updatedFavorites.length) {
        return res.status(404).json({
          status: 'error',
          message: 'Player not found in favorites'
        });
      }

      await coachProfile.update({
        favoriteProfiles: updatedFavorites
      });

      console.log(`✅ Player ${playerId} removed from favorites for coach ${req.user.email}`);

      return res.status(200).json({
        status: 'success',
        message: 'Player removed from favorites successfully',
        data: {
          removedPlayerId: playerId,
          totalFavorites: updatedFavorites.length
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
   * 🔄 NOUVELLE MÉTHODE : Mettre à jour le statut d'un favori
   * Cette méthode était manquante et causait l'erreur Express !
   */
  static async updateFavoriteStatus(req, res) {
    try {
      const { playerId } = req.params;
      const userId = req.user.id;
      const updateData = req.body;

      console.log(`🔄 Updating favorite status for player ${playerId} by coach: ${req.user.email}`);

      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found'
        });
      }

      const currentFavorites = coachProfile.favoriteProfiles || [];
      const favoriteIndex = currentFavorites.findIndex(fav => fav.playerId == playerId);

      if (favoriteIndex === -1) {
        return res.status(404).json({
          status: 'error',
          message: 'Player not found in favorites'
        });
      }

      // Mettre à jour le favori
      const updatedFavorite = {
        ...currentFavorites[favoriteIndex],
        ...updateData,
        lastUpdated: new Date()
      };

      currentFavorites[favoriteIndex] = updatedFavorite;

      await coachProfile.update({
        favoriteProfiles: currentFavorites
      });

      console.log(`✅ Favorite status updated for player ${playerId} by coach ${req.user.email}`);

      return res.status(200).json({
        status: 'success',
        message: 'Favorite status updated successfully',
        data: {
          playerId: playerId,
          updatedFavorite: updatedFavorite,
          updatedAt: new Date()
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
   * 📋 Récupérer la liste des favoris
   */
  static async getFavoriteProfiles(req, res) {
    try {
      const userId = req.user.id;
      const { status, priority, page = 1, limit = 20 } = req.query;

      console.log(`📋 Loading favorites for coach: ${req.user.email}`);

      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found'
        });
      }

      let favorites = coachProfile.favoriteProfiles || [];

      // Filtrage optionnel
      if (status) {
        favorites = favorites.filter(fav => fav.status === status);
      }
      if (priority) {
        favorites = favorites.filter(fav => fav.priority === priority);
      }

      // Pagination
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedFavorites = favorites.slice(startIndex, endIndex);

      // Enrichir avec les données des joueurs
      const enrichedFavorites = await Promise.all(
        paginatedFavorites.map(async (fav) => {
          const playerProfile = await PlayerProfile.findByPk(fav.playerId, {
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

          return {
            favorite: fav,
            player: playerProfile ? playerProfile.toJSON() : null
          };
        })
      );

      return res.status(200).json({
        status: 'success',
        message: 'Favorite profiles retrieved successfully',
        data: {
          favorites: enrichedFavorites.filter(item => item.player !== null),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: favorites.length,
            totalPages: Math.ceil(favorites.length / parseInt(limit))
          },
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
   * 💾 NOUVELLE MÉTHODE : Récupérer les recherches sauvegardées
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
          message: 'Coach profile not found'
        });
      }

      // Les recherches sont stockées dans le champ JSON savedSearches
      const savedSearches = coachProfile.savedSearches || [];

      // Enrichir avec des métadonnées utiles
      const enrichedSearches = savedSearches.map((search, index) => ({
        id: search.id || index,
        name: search.name || `Search ${index + 1}`,
        criteria: search.criteria || search,
        createdAt: search.savedAt || search.createdAt || new Date(),
        lastUsed: search.lastUsed || null,
        useCount: search.useCount || 0
      }));

      // Trier par date de création (plus récent en premier)
      enrichedSearches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return res.status(200).json({
        status: 'success',
        message: 'Saved searches retrieved successfully',
        data: {
          searches: enrichedSearches,
          totalCount: enrichedSearches.length,
          summary: {
            totalSearches: coachProfile.totalSearches || 0,
            savedSearches: enrichedSearches.length,
            mostRecentSearch: enrichedSearches.length > 0 ? enrichedSearches[0].createdAt : null
          }
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
   * ➕ NOUVELLE MÉTHODE : Sauvegarder une nouvelle recherche
   */
  static async saveSearch(req, res) {
    try {
      const userId = req.user.id;
      const searchData = req.body;

      console.log(`➕ Saving new search for coach: ${req.user.email}`);

      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found'
        });
      }

      // Récupérer les recherches existantes
      const currentSearches = coachProfile.savedSearches || [];

      // Créer la nouvelle recherche avec métadonnées
      const newSearch = {
        id: Date.now(), // ID simple basé sur timestamp
        name: searchData.name || `Search ${currentSearches.length + 1}`,
        criteria: {
          gender: searchData.gender,
          collegeState: searchData.collegeState,
          collegeRegion: searchData.collegeRegion,
          profileStatus: searchData.profileStatus,
          minViews: searchData.minViews,
          sortBy: searchData.sortBy,
          sortOrder: searchData.sortOrder
        },
        savedAt: new Date(),
        lastUsed: null,
        useCount: 0
      };

      // Ajouter la nouvelle recherche
      const updatedSearches = [...currentSearches, newSearch];

      // Garder seulement les 20 recherches les plus récentes
      if (updatedSearches.length > 20) {
        updatedSearches.splice(0, updatedSearches.length - 20);
      }

      // Mettre à jour le profil
      await coachProfile.update({
        savedSearches: updatedSearches,
        totalSearches: (coachProfile.totalSearches || 0) + 1
      });

      console.log(`✅ Search saved successfully for coach ${req.user.email}`);

      return res.status(201).json({
        status: 'success',
        message: 'Search saved successfully',
        data: {
          search: newSearch,
          totalSavedSearches: updatedSearches.length
        }
      });

    } catch (error) {
      console.error(`❌ Error saving search for coach ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to save search',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 🗑️ NOUVELLE MÉTHODE : Supprimer une recherche sauvegardée
   */
  static async deleteSavedSearch(req, res) {
    try {
      const userId = req.user.id;
      const { searchId } = req.params;

      console.log(`🗑️ Deleting saved search ${searchId} for coach: ${req.user.email}`);

      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found'
        });
      }

      const currentSearches = coachProfile.savedSearches || [];
      const updatedSearches = currentSearches.filter(search => search.id != searchId);

      if (currentSearches.length === updatedSearches.length) {
        return res.status(404).json({
          status: 'error',
          message: 'Saved search not found'
        });
      }

      await coachProfile.update({
        savedSearches: updatedSearches
      });

      console.log(`✅ Saved search ${searchId} deleted for coach ${req.user.email}`);

      return res.status(200).json({
        status: 'success',
        message: 'Saved search deleted successfully',
        data: {
          deletedSearchId: searchId,
          remainingSearches: updatedSearches.length
        }
      });

    } catch (error) {
      console.error(`❌ Error deleting saved search for coach ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to delete saved search',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  // ========================
  // MÉTHODES UTILITAIRES STATIQUES
  // ========================

  /**
   * Calcule la complétude du profil coach
   */
  static calculateCoachProfileCompleteness(coachProfile) {
    let completedFields = 0;
    const totalFields = 10;

    if (coachProfile.position) completedFields++;
    if (coachProfile.phoneNumber) completedFields++;
    if (coachProfile.collegeId) completedFields++;
    if (coachProfile.division) completedFields++;
    if (coachProfile.teamSport) completedFields++;
    if (coachProfile.user && coachProfile.user.firstName) completedFields++;
    if (coachProfile.user && coachProfile.user.lastName) completedFields++;
    if (coachProfile.user && coachProfile.user.email) completedFields++;
    
    // Champs futurs (pour l'évolution du profil)
    if (coachProfile.bio) completedFields++;
    if (coachProfile.experience) completedFields++;

    return Math.round((completedFields / totalFields) * 100);
  }

  /**
   * Génère des actions rapides pour le dashboard
   */
  static generateQuickActions(coachProfile) {
    const actions = [];

    actions.push({
      title: 'Search Players',
      description: 'Find new talent for your program',
      action: 'search_players',
      icon: '🔍',
      priority: 'high'
    });

    if (coachProfile.savedSearches && coachProfile.savedSearches.length > 0) {
      actions.push({
        title: 'Run Saved Search',
        description: 'Execute your most recent search',
        action: 'run_saved_search',
        icon: '⚡',
        priority: 'medium'
      });
    }

    actions.push({
      title: 'Review Favorites',
      description: 'Update recruitment status',
      action: 'review_favorites',
      icon: '⭐',
      priority: 'medium'
    });

    return actions;
  }

  // Méthodes utilitaires avec implémentations robustes
  static async getRecentFavorites(coachProfileId, limit) {
    try {
      const coachProfile = await CoachProfile.findByPk(coachProfileId);
      if (!coachProfile) return [];
      
      const favorites = coachProfile.favoriteProfiles || [];
      
      return favorites
        .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting recent favorites:', error);
      return [];
    }
  }

  static async getTopSavedSearches(coachProfileId, limit) {
    try {
      const coachProfile = await CoachProfile.findByPk(coachProfileId);
      if (!coachProfile) return [];
      
      const searches = coachProfile.savedSearches || [];
      
      return searches
        .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting top saved searches:', error);
      return [];
    }
  }

  static async calculateRecruitingStats(coachProfileId) {
    try {
      const coachProfile = await CoachProfile.findByPk(coachProfileId);
      if (!coachProfile) {
        return {
          totalFavorites: 0,
          activeRecruitments: 0,
          thisMonth: { newFavorites: 0, contactsMade: 0 }
        };
      }
      
      const favorites = coachProfile.favoriteProfiles || [];
      const thisMonth = new Date();
      thisMonth.setDate(1);
      
      const thisMonthFavorites = favorites.filter(fav => 
        new Date(fav.addedAt) >= thisMonth
      );
      
      return {
        totalFavorites: favorites.length,
        activeRecruitments: favorites.filter(fav => 
          ['contacted', 'evaluating', 'interested'].includes(fav.status)
        ).length,
        thisMonth: {
          newFavorites: thisMonthFavorites.length,
          contactsMade: favorites.filter(fav => 
            fav.status === 'contacted' && new Date(fav.lastUpdated) >= thisMonth
          ).length
        }
      };
    } catch (error) {
      console.error('Error calculating recruiting stats:', error);
      return {
        totalFavorites: 0,
        activeRecruitments: 0,
        thisMonth: { newFavorites: 0, contactsMade: 0 }
      };
    }
  }

  static async getCoachRecentActivity(coachProfileId) {
    try {
      const coachProfile = await CoachProfile.findByPk(coachProfileId);
      if (!coachProfile) return [];
      
      const activities = [];
      
      if (coachProfile.lastProfileUpdate) {
        activities.push({
          type: 'profile_update',
          description: 'Profile information updated',
          timestamp: coachProfile.lastProfileUpdate,
          icon: '✏️'
        });
      }
      
      activities.push({
        type: 'profile_created',
        description: 'Coach profile created',
        timestamp: coachProfile.createdAt,
        icon: '🎉'
      });
      
      return activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);
    } catch (error) {
      console.error('Error getting coach recent activity:', error);
      return [];
    }
  }

  static async generateCoachRecommendations(coachProfile) {
    const recommendations = [];
    
    const completionPercentage = CoachController.calculateCoachProfileCompleteness(coachProfile);
    
    if (completionPercentage < 70) {
      recommendations.push({
        type: 'profile_completion',
        title: 'Complete Your Profile',
        description: 'A complete profile builds trust with potential recruits',
        action: 'Complete profile',
        priority: 'high'
      });
    }
    
    if ((coachProfile.totalSearches || 0) < 5) {
      recommendations.push({
        type: 'search_activity',
        title: 'Start Searching for Players',
        description: 'Use our advanced search to find players that match your needs',
        action: 'Start searching',
        priority: 'medium'
      });
    }

    return recommendations;
  }

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

  // Méthodes analytics (implémentation future pour analytics plus détaillées)
  static async calculateWeeklySearchAverage(coachProfileId) { return 0; }
  static async analyzeMostUsedFilters(savedSearches) { return []; }
  static async calculateFavoritesMetrics(coachProfileId) { return {}; }
  static async analyzeActivityPatterns(coachProfileId) { return {}; }
  static async generateOptimizationRecommendations(coachProfile) { return []; }
  static calculateRecruitingEfficiency(searchMetrics, favoritesMetrics) { return 0; }
  static async calculateEngagementScore(coachProfileId) { return 0; }
}

module.exports = CoachController;