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
   * 
   * Le dashboard coach est comme un "tableau de bord de pilote" pour le recrutement.
   * Il rassemble toutes les métriques importantes : favoris récents, recherches actives,
   * statistiques d'activité, et recommandations d'actions.
   * 
   * Processus de construction :
   * 1. Profil complet du coach avec college et statistiques
   * 2. Favoris récents avec statuts de recrutement
   * 3. Recherches sauvegardées les plus utilisées
   * 4. Métriques d'activité et recommendations
   */
  static async getDashboard(req, res) {
    try {
      const userId = req.user.id;
      
      console.log(`📊 Loading coach dashboard for: ${req.user.email}`);

      // ========================
      // RÉCUPÉRATION DU PROFIL COMPLET AVEC RELATIONS
      // ========================
      
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

      // ========================
      // FAVORIS RÉCENTS AVEC DÉTAILS DES JOUEURS
      // ========================
      
      const recentFavorites = await this.getRecentFavorites(coachProfile.id, 5);
      
      // ========================
      // RECHERCHES SAUVEGARDÉES LES PLUS UTILISÉES
      // ========================
      
      const topSavedSearches = await this.getTopSavedSearches(coachProfile.id, 3);
      
      // ========================
      // STATISTIQUES D'ACTIVITÉ DE RECRUTEMENT
      // ========================
      
      const recruitingStats = await this.calculateRecruitingStats(coachProfile.id);
      
      // ========================
      // ACTIVITÉ RÉCENTE ET NOTIFICATIONS
      // ========================
      
      const recentActivity = await this.getCoachRecentActivity(coachProfile.id);
      
      // ========================
      // RECOMMENDATIONS PERSONNALISÉES POUR AMÉLIORER LE RECRUTEMENT
      // ========================
      
      const recommendations = await this.generateCoachRecommendations(coachProfile);

      // ========================
      // CONSTRUCTION DE LA RÉPONSE DASHBOARD COMPLÈTE
      // ========================
      
      const dashboardData = {
        profile: {
          ...coachProfile.toJSON(),
          profileCompleteness: this.calculateCoachProfileCompleteness(coachProfile)
        },
        recruiting: {
          recentFavorites: recentFavorites,
          savedSearches: topSavedSearches,
          statistics: recruitingStats
        },
        activity: recentActivity,
        recommendations: recommendations,
        quickActions: this.generateQuickActions(coachProfile),
        lastUpdated: new Date()
      };

      console.log(`✅ Coach dashboard loaded successfully for: ${req.user.email}`);

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
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * 👤 Profil public d'un coach (pour joueurs et autres coachs)
   * 
   * Cette méthode gère l'affichage du profil coach vu par les autres utilisateurs.
   * Contrairement aux joueurs, les profils coachs sont généralement plus ouverts
   * car ils représentent des programmes de recrutement actifs.
   */
  static async getCoachProfile(req, res) {
    try {
      const { coachId } = req.params;
      const viewerUser = req.user;

      console.log(`👁️ Coach profile requested: ID ${coachId} by ${viewerUser.email}`);

      // ========================
      // RÉCUPÉRATION DU PROFIL AVEC TOUTES LES RELATIONS
      // ========================
      
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

      // ========================
      // CONTRÔLES D'ACCÈS ET PERMISSIONS
      // ========================
      
      const isOwnProfile = coachProfile.userId === viewerUser.id;
      const isAdmin = viewerUser.userType === 'admin';
      
      // Les profils coachs sont généralement publics (contrairement aux joueurs)
      // mais on peut ajouter des contrôles spécifiques si nécessaire

      // ========================
      // ENRICHISSEMENT DES DONNÉES SELON LE TYPE DE VIEWER
      // ========================
      
      const profileData = {
        ...coachProfile.toJSON(),
        isOwnProfile: isOwnProfile,
        canEdit: isOwnProfile || isAdmin,
        viewerType: viewerUser.userType
      };

      // Si c'est un joueur qui regarde, ajouter des infos utiles pour le contact
      if (viewerUser.userType === 'player') {
        profileData.recruiting = {
          isRecruiting: true, // Les coachs recrutent généralement activement
          preferredContact: 'Please send your game highlights and academic transcript',
          responseTime: 'Usually responds within 48 hours'
        };
      }

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
   * 📈 Analytics détaillées du coach - Métriques de recrutement
   * 
   * Cette méthode fournit des insights approfondis sur l'activité de recrutement :
   * efficacité des recherches, conversion des favoris, patterns d'activité, etc.
   * 
   * Pensez à cela comme un "rapport de performance commerciale" pour le recrutement.
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

      // ========================
      // MÉTRIQUES DE RECHERCHE ET DÉCOUVERTE
      // ========================
      
      const searchMetrics = {
        totalSearches: coachProfile.totalSearches,
        savedSearches: coachProfile.savedSearches.length,
        averageSearchesPerWeek: await this.calculateWeeklySearchAverage(coachProfile.id),
        mostUsedFilters: await this.analyzeMostUsedFilters(coachProfile.savedSearches)
      };

      // ========================
      // MÉTRIQUES DE FAVORIS ET CONVERSION
      // ========================
      
      const favoritesMetrics = await this.calculateFavoritesMetrics(coachProfile.id);
      
      // ========================
      // ANALYSE DES PATTERNS D'ACTIVITÉ
      // ========================
      
      const activityPatterns = await this.analyzeActivityPatterns(coachProfile.id);
      
      // ========================
      // RECOMMANDATIONS D'OPTIMISATION
      // ========================
      
      const optimizationRecommendations = await this.generateOptimizationRecommendations(coachProfile);

      // ========================
      // COMPILATION DES ANALYTICS COMPLÈTES
      // ========================
      
      const analytics = {
        searching: searchMetrics,
        favorites: favoritesMetrics,
        activity: activityPatterns,
        performance: {
          recruitingEfficiency: this.calculateRecruitingEfficiency(searchMetrics, favoritesMetrics),
          profileCompleteness: this.calculateCoachProfileCompleteness(coachProfile),
          engagementScore: await this.calculateEngagementScore(coachProfile.id)
        },
        recommendations: optimizationRecommendations,
        timeframe: {
          from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 jours
          to: new Date(),
          generatedAt: new Date()
        }
      };

      return res.status(200).json({
        status: 'success',
        message: 'Coach analytics retrieved successfully',
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
   * Cette méthode gère la mise à jour des informations professionnelles du coach
   * avec validation métier stricte car les données influencent le recrutement.
   */
  static async updateCoachProfile(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const userId = req.user.id;
      const updateData = req.body;

      console.log(`✏️ Updating profile for coach: ${req.user.email}`);

      // ========================
      // RÉCUPÉRATION DU PROFIL EXISTANT
      // ========================
      
      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId },
        transaction
      });

      if (!coachProfile) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found'
        });
      }

      // ========================
      // VALIDATIONS MÉTIER SPÉCIALISÉES POUR COACHS
      // ========================
      
      // Si le college change, vérifier cohérence avec la division
      if (updateData.collegeId && updateData.collegeId !== coachProfile.collegeId) {
        const college = await NCAACollege.findByPk(updateData.collegeId, { transaction });
        
        if (!college || !college.isActive) {
          await transaction.rollback();
          return res.status(400).json({
            status: 'error',
            message: 'Selected college is not valid or inactive',
            code: 'INVALID_COLLEGE'
          });
        }

        // Vérifier que la division correspond toujours
        if (updateData.division && college.division !== updateData.division) {
          await transaction.rollback();
          return res.status(400).json({
            status: 'error',
            message: `Division mismatch: ${college.name} is ${college.division}, but you selected ${updateData.division}`,
            code: 'DIVISION_MISMATCH'
          });
        }
      }

      // Validation du numéro de téléphone pour les coachs (crucial pour le recrutement)
      if (updateData.phoneNumber && !/^\+?[\d\s\-\(\)]+$/.test(updateData.phoneNumber)) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Invalid phone number format for recruiting contact',
          code: 'INVALID_PHONE'
        });
      }

      // ========================
      // MISE À JOUR DU PROFIL AVEC TRANSACTION
      // ========================
      
      const updatedProfile = await coachProfile.update(updateData, { transaction });

      await transaction.commit();

      // ========================
      // RÉCUPÉRATION DU PROFIL COMPLET MIS À JOUR
      // ========================
      
      const refreshedProfile = await CoachProfile.findOne({
        where: { userId: userId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['firstName', 'lastName', 'email']
          },
          {
            model: NCAACollege,
            as: 'college',
            attributes: ['name', 'state', 'division']
          }
        ]
      });

      console.log(`✅ Profile updated successfully for coach: ${req.user.email}`);

      return res.status(200).json({
        status: 'success',
        message: 'Coach profile updated successfully',
        data: {
          profile: refreshedProfile,
          completeness: this.calculateCoachProfileCompleteness(refreshedProfile)
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error(`❌ Error updating coach profile for ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update coach profile',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * ⭐ Gestion des favoris - Fonctionnalité cœur du recrutement
   * 
   * Les méthodes suivantes gèrent le système de favoris qui est central au workflow
   * de recrutement des coachs. C'est leur outil principal pour organiser et suivre
   * les prospects intéressants.
   */

  /**
   * 📋 Récupérer tous les favoris du coach avec filtres et tri
   */
  static async getFavoriteProfiles(req, res) {
    try {
      const userId = req.user.id;
      const { 
        priority = 'all', 
        status = 'all',
        page = 1,
        limit = 20,
        sortBy = 'favorited_at',
        sortOrder = 'desc'
      } = req.query;

      console.log(`⭐ Loading favorites for coach: ${req.user.email}`);

      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found'
        });
      }

      // ========================
      // CONSTRUCTION DES CONDITIONS DE FILTRAGE
      // ========================
      
      const whereConditions = {
        coachProfileId: coachProfile.id
      };

      if (priority !== 'all') {
        whereConditions.priorityLevel = priority;
      }

      if (status !== 'all') {
        whereConditions.recruitmentStatus = status;
      }

      // ========================
      // RÉCUPÉRATION DES FAVORIS AVEC PAGINATION
      // ========================
      
      const { count, rows: favorites } = await sequelize.query(`
        SELECT 
          cf.*,
          pp.gender,
          pp.profile_completion_status,
          pp.is_profile_visible,
          pp.profile_views,
          u.first_name,
          u.last_name,
          u.email,
          nc.name as college_name,
          nc.state as college_state,
          nc.region as college_region
        FROM coach_favorites cf
        JOIN player_profiles pp ON cf.player_profile_id = pp.id
        JOIN users u ON pp.user_id = u.id
        JOIN njcaa_colleges nc ON pp.college_id = nc.id
        WHERE cf.coach_profile_id = :coachProfileId
        ${priority !== 'all' ? 'AND cf.priority_level = :priority' : ''}
        ${status !== 'all' ? 'AND cf.recruitment_status = :status' : ''}
        ORDER BY cf.${sortBy} ${sortOrder.toUpperCase()}
        LIMIT :limit OFFSET :offset
      `, {
        replacements: {
          coachProfileId: coachProfile.id,
          ...(priority !== 'all' && { priority }),
          ...(status !== 'all' && { status }),
          limit: parseInt(limit),
          offset: (parseInt(page) - 1) * parseInt(limit)
        },
        type: sequelize.QueryTypes.SELECT
      });

      // Compter le total pour la pagination
      const totalFavorites = await sequelize.query(`
        SELECT COUNT(*) as count
        FROM coach_favorites cf
        WHERE cf.coach_profile_id = :coachProfileId
        ${priority !== 'all' ? 'AND cf.priority_level = :priority' : ''}
        ${status !== 'all' ? 'AND cf.recruitment_status = :status' : ''}
      `, {
        replacements: {
          coachProfileId: coachProfile.id,
          ...(priority !== 'all' && { priority }),
          ...(status !== 'all' && { status })
        },
        type: sequelize.QueryTypes.SELECT
      });

      const totalCount = totalFavorites[0].count;

      // ========================
      // ENRICHISSEMENT DES DONNÉES POUR L'AFFICHAGE
      // ========================
      
      const enrichedFavorites = favorites.map(favorite => ({
        favoriteId: favorite.id,
        playerId: favorite.player_profile_id,
        player: {
          firstName: favorite.first_name,
          lastName: favorite.last_name,
          email: favorite.email,
          gender: favorite.gender,
          profileViews: favorite.profile_views,
          profileStatus: favorite.profile_completion_status,
          isVisible: favorite.is_profile_visible,
          college: {
            name: favorite.college_name,
            state: favorite.college_state,
            region: favorite.college_region
          }
        },
        favorite: {
          priority: favorite.priority_level,
          status: favorite.recruitment_status,
          notes: favorite.notes,
          favoritedAt: favorite.favorited_at,
          lastContacted: favorite.last_contacted,
          updatedAt: favorite.updated_at
        }
      }));

      return res.status(200).json({
        status: 'success',
        message: 'Favorite profiles retrieved successfully',
        data: {
          favorites: enrichedFavorites,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(totalCount),
            totalPages: Math.ceil(totalCount / limit)
          },
          filters: {
            priority,
            status,
            sortBy,
            sortOrder
          },
          summary: await this.getFavoritesSummary(coachProfile.id)
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
   * ➕ Ajouter un joueur aux favoris
   */
  static async addToFavorites(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const userId = req.user.id;
      const { playerId } = req.params;
      const { priority = 'medium', notes = '', recruitmentStatus = 'interested' } = req.body;

      console.log(`➕ Adding player ${playerId} to favorites for coach: ${req.user.email}`);

      // ========================
      // VÉRIFICATIONS PRÉLIMINAIRES
      // ========================
      
      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId },
        transaction
      });

      if (!coachProfile) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found'
        });
      }

      // Vérifier que le joueur existe et est visible
      const playerProfile = await PlayerProfile.findByPk(playerId, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['firstName', 'lastName', 'email']
          }
        ],
        transaction
      });

      if (!playerProfile) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Player profile not found',
          code: 'PLAYER_NOT_FOUND'
        });
      }

      if (!playerProfile.isProfileVisible) {
        await transaction.rollback();
        return res.status(403).json({
          status: 'error',
          message: 'This player profile is private',
          code: 'PROFILE_PRIVATE'
        });
      }

      // ========================
      // VÉRIFIER SI DÉJÀ EN FAVORIS
      // ========================
      
      const existingFavorite = await sequelize.query(`
        SELECT id FROM coach_favorites 
        WHERE coach_profile_id = :coachProfileId AND player_profile_id = :playerProfileId
      `, {
        replacements: {
          coachProfileId: coachProfile.id,
          playerProfileId: playerId
        },
        type: sequelize.QueryTypes.SELECT,
        transaction
      });

      if (existingFavorite.length > 0) {
        await transaction.rollback();
        return res.status(409).json({
          status: 'error',
          message: 'Player is already in your favorites',
          code: 'ALREADY_FAVORITED'
        });
      }

      // ========================
      // AJOUTER AUX FAVORIS
      // ========================
      
      await sequelize.query(`
        INSERT INTO coach_favorites 
        (coach_profile_id, player_profile_id, priority_level, recruitment_status, notes, favorited_at, updated_at)
        VALUES (:coachProfileId, :playerProfileId, :priority, :status, :notes, NOW(), NOW())
      `, {
        replacements: {
          coachProfileId: coachProfile.id,
          playerProfileId: playerId,
          priority: priority,
          status: recruitmentStatus,
          notes: notes
        },
        transaction
      });

      await transaction.commit();

      console.log(`✅ Player ${playerId} added to favorites successfully for coach: ${req.user.email}`);

      return res.status(201).json({
        status: 'success',
        message: `${playerProfile.user.firstName} ${playerProfile.user.lastName} has been added to your favorites`,
        data: {
          playerId: playerId,
          playerName: `${playerProfile.user.firstName} ${playerProfile.user.lastName}`,
          priority: priority,
          status: recruitmentStatus,
          favoritedAt: new Date()
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error(`❌ Error adding to favorites for coach ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to add player to favorites',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

	/**
   * ➖ Retirer un joueur des favoris
   * NOUVELLE MÉTHODE - Corrige l'erreur "undefined callback"
   */
  static async removeFromFavorites(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const userId = req.user.id;
      const { playerId } = req.params;

      console.log(`➖ Removing player ${playerId} from favorites for coach: ${req.user.email}`);

      // Récupération du profil coach
      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId },
        transaction
      });

      if (!coachProfile) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found'
        });
      }

      // Vérifier que le favori existe
      const existingFavorite = await sequelize.query(`
        SELECT id, player_profile_id FROM coach_favorites 
        WHERE coach_profile_id = :coachProfileId AND player_profile_id = :playerProfileId
      `, {
        replacements: {
          coachProfileId: coachProfile.id,
          playerProfileId: playerId
        },
        type: sequelize.QueryTypes.SELECT,
        transaction
      });

      if (existingFavorite.length === 0) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Player is not in your favorites',
          code: 'NOT_IN_FAVORITES'
        });
      }

      // Supprimer le favori
      await sequelize.query(`
        DELETE FROM coach_favorites 
        WHERE coach_profile_id = :coachProfileId AND player_profile_id = :playerProfileId
      `, {
        replacements: {
          coachProfileId: coachProfile.id,
          playerProfileId: playerId
        },
        transaction
      });

      await transaction.commit();

      console.log(`✅ Player ${playerId} removed from favorites successfully for coach: ${req.user.email}`);

      return res.status(200).json({
        status: 'success',
        message: 'Player removed from favorites successfully',
        data: {
          playerId: playerId,
          removedAt: new Date()
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error(`❌ Error removing from favorites for coach ${req.user.email}:`, error);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to remove player from favorites',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * ✏️ Mettre à jour le statut/notes d'un favori
   * NOUVELLE MÉTHODE - Corrige l'erreur "undefined callback"
   */
  static async updateFavoriteStatus(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const userId = req.user.id;
      const { playerId } = req.params;
      const { priority, recruitmentStatus, notes, lastContacted } = req.body;

      console.log(`✏️ Updating favorite status for player ${playerId} by coach: ${req.user.email}`);

      const coachProfile = await CoachProfile.findOne({
        where: { userId: userId },
        transaction
      });

      if (!coachProfile) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found'
        });
      }

      // Vérifier que le favori existe
      const existingFavorite = await sequelize.query(`
        SELECT * FROM coach_favorites 
        WHERE coach_profile_id = :coachProfileId AND player_profile_id = :playerProfileId
      `, {
        replacements: {
          coachProfileId: coachProfile.id,
          playerProfileId: playerId
        },
        type: sequelize.QueryTypes.SELECT,
        transaction
      });

      if (existingFavorite.length === 0) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Player is not in your favorites',
          code: 'NOT_IN_FAVORITES'
        });
      }

      // Construire l'objet de mise à jour
      const updateFields = ['updated_at = NOW()'];
      const replacements = {
        coachProfileId: coachProfile.id,
        playerProfileId: playerId
      };

      if (priority) {
        updateFields.push('priority_level = :priority');
        replacements.priority = priority;
      }

      if (recruitmentStatus) {
        updateFields.push('recruitment_status = :status');
        replacements.status = recruitmentStatus;
      }

      if (notes !== undefined) {
        updateFields.push('notes = :notes');
        replacements.notes = notes;
      }

      if (lastContacted) {
        updateFields.push('last_contacted = :lastContacted');
        replacements.lastContacted = lastContacted;
      }

      // Mettre à jour le favori
      await sequelize.query(`
        UPDATE coach_favorites 
        SET ${updateFields.join(', ')}
        WHERE coach_profile_id = :coachProfileId AND player_profile_id = :playerProfileId
      `, {
        replacements,
        transaction
      });

      await transaction.commit();

      console.log(`✅ Favorite status updated successfully for player ${playerId} by coach: ${req.user.email}`);

      return res.status(200).json({
        status: 'success',
        message: 'Favorite status updated successfully',
        data: {
          playerId: playerId,
          updatedFields: Object.keys(req.body),
          updatedAt: new Date()
        }
      });

    } catch (error) {
      await transaction.rollback();
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
   * NOUVELLE MÉTHODE - Corrige l'erreur "undefined callback"
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
            totalSearches: coachProfile.totalSearches,
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
   * ➕ Sauvegarder une nouvelle recherche
   * NOUVELLE MÉTHODE - Corrige l'erreur "undefined callback"
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
        savedSearches: updatedSearches
      });

      console.log(`✅ Search saved successfully for coach: ${req.user.email}`);

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
   * 🗑️ Supprimer une recherche sauvegardée
   * NOUVELLE MÉTHODE - Corrige l'erreur "undefined callback"
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

      // Récupérer les recherches existantes
      const currentSearches = coachProfile.savedSearches || [];

      // Trouver l'index de la recherche à supprimer
      const searchIndex = currentSearches.findIndex(search => 
        search.id === parseInt(searchId) || search.id === searchId
      );

      if (searchIndex === -1) {
        return res.status(404).json({
          status: 'error',
          message: 'Saved search not found',
          code: 'SEARCH_NOT_FOUND'
        });
      }

      // Supprimer la recherche
      const deletedSearch = currentSearches[searchIndex];
      const updatedSearches = currentSearches.filter((_, index) => index !== searchIndex);

      // Mettre à jour le profil
      await coachProfile.update({
        savedSearches: updatedSearches
      });

      console.log(`✅ Search deleted successfully for coach: ${req.user.email}`);

      return res.status(200).json({
        status: 'success',
        message: 'Saved search deleted successfully',
        data: {
          deletedSearch: {
            id: deletedSearch.id,
            name: deletedSearch.name,
            deletedAt: new Date()
          },
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
  // MÉTHODES UTILITAIRES PRIVÉES POUR COACHS
  // ========================
  
  /**
   * Calcule la complétude du profil coach
   */
  static calculateCoachProfileCompleteness(coachProfile) {
    let completedFields = 0;
    const totalFields = 10;

    // Champs obligatoires (toujours remplis)
    if (coachProfile.position) completedFields++;
    if (coachProfile.phoneNumber) completedFields++;
    if (coachProfile.collegeId) completedFields++;
    if (coachProfile.division) completedFields++;
    if (coachProfile.teamSport) completedFields++;

    // Champs enrichisseurs
    if (coachProfile.user && coachProfile.user.firstName) completedFields++;
    if (coachProfile.user && coachProfile.user.lastName) completedFields++;
    if (coachProfile.user && coachProfile.user.email) completedFields++;

    // Champs d'activité
    if (coachProfile.totalSearches > 0) completedFields++;
    if (coachProfile.savedSearches && coachProfile.savedSearches.length > 0) completedFields++;

    return Math.round((completedFields / totalFields) * 100);
  }

  /**
   * Génère des actions rapides personnalisées pour le coach
   */
  static generateQuickActions(coachProfile) {
    const actions = [];

    actions.push({
      title: 'Search Players',
      description: 'Find new prospects in your region',
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

  // Méthodes utilitaires qui seront implémentées avec de vraies données plus tard
  static async getRecentFavorites(coachProfileId, limit) {
    // Simuler pour l'instant
    return [];
  }

  static async getTopSavedSearches(coachProfileId, limit) {
    return [];
  }

  static async calculateRecruitingStats(coachProfileId) {
    return {
      totalFavorites: 0,
      activeRecruitments: 0,
      thisMonth: {
        newFavorites: 0,
        contactsMade: 0
      }
    };
  }

  static async getCoachRecentActivity(coachProfileId) {
    return [];
  }

  static async generateCoachRecommendations(coachProfile) {
    const recommendations = [];
    
    if (coachProfile.totalSearches < 5) {
      recommendations.push({
        type: 'search_activity',
        title: 'Start Searching for Players',
        description: 'Use our advanced search to find players that match your needs',
        action: 'Start searching',
        priority: 'high'
      });
    }

    return recommendations;
  }

  static async getFavoritesSummary(coachProfileId) {
    return {
      total: 0,
      byPriority: { high: 0, medium: 0, low: 0 },
      byStatus: { interested: 0, contacted: 0, evaluating: 0 }
    };
  }

  // Méthodes analytics (implémentation future)
  static async calculateWeeklySearchAverage(coachProfileId) { return 0; }
  static async analyzeMostUsedFilters(savedSearches) { return []; }
  static async calculateFavoritesMetrics(coachProfileId) { return {}; }
  static async analyzeActivityPatterns(coachProfileId) { return {}; }
  static async generateOptimizationRecommendations(coachProfile) { return []; }
  static calculateRecruitingEfficiency(searchMetrics, favoritesMetrics) { return 0; }
  static async calculateEngagementScore(coachProfileId) { return 0; }
}

module.exports = CoachController;