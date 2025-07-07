// server/controllers/njcaaCoachController.js

const { User, PlayerProfile, NJCAACoachProfile, PlayerEvaluation, NJCAACollege } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database.connection');

/**
 * 🏟️ Contrôleur pour la gestion des coachs NJCAA avec leurs fonctionnalités spécialisées
 * 
 * ARCHITECTURE MÉTIER : Ce contrôleur gère un workflow complètement différent
 * des autres types d'utilisateurs. Les coachs NJCAA ne payent pas d'abonnement
 * et ne recherchent pas de joueurs. Leur rôle principal est d'évaluer leurs
 * propres joueurs pour aider les coachs NCAA/NAIA dans leur recrutement.
 */
class NJCAACoachController {
  /**
   * 📊 Dashboard principal du coach NJCAA - Page "Main Page"
   * 
   * Cette méthode fournit une vue d'ensemble complète des joueurs que le coach
   * peut évaluer, avec un filtrage intelligent basé sur :
   * - Le même college que le coach
   * - Le même genre (masculine/féminine) selon l'équipe du coach
   * - Les évaluations existantes et leur statut
   * 
   * LOGIQUE MÉTIER : Un coach masculin ne voit que les joueurs masculins
   * de son college, et vice versa pour les coachs féminins.
   */
  static async getDashboard(req, res) {
    try {
      const userId = req.user.id;
      
      console.log(`📊 Loading NJCAA coach dashboard for: ${req.user.email}`);

      // Récupération du profil complet du coach avec son college
      const coachProfile = await NJCAACoachProfile.findOne({
        where: { userId: userId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email', 'isActive', 'createdAt']
          },
          {
            model: NJCAACollege,
            as: 'college',
            attributes: ['id', 'name', 'state', 'region', 'isActive']
          }
        ]
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'NJCAA coach profile not found',
          code: 'COACH_PROFILE_NOT_FOUND'
        });
      }

      // 🎯 LOGIQUE CRUCIALE : Déterminer le genre des joueurs selon l'équipe du coach
      // ✅ CORRECTION : Condition ternaire complète avec toutes les options
      const playerGender = coachProfile.teamSport === 'mens_soccer' ? 'male' : 
                          coachProfile.teamSport === 'womens_soccer' ? 'female' :
                          null; // Pour les sports mixtes ou autres cas spéciaux

      if (!playerGender) {
        console.log(`⚠️ Unknown team sport: ${coachProfile.teamSport}, showing all players`);
      }

      // 🔍 Rechercher tous les joueurs du même college et du bon genre
      const playersQuery = {
        collegeId: coachProfile.collegeId,
        isProfileVisible: true
      };

      // Ajouter le filtre de genre seulement si déterminé
      if (playerGender) {
        playersQuery.gender = playerGender;
      }

      const players = await PlayerProfile.findAll({
        where: playersQuery,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email', 'isActive']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      console.log(`🎯 Found ${players.length} ${playerGender || 'all'} players in college ${coachProfile.collegeId}`);

      // 📊 Récupérer les évaluations existantes pour tous ces joueurs
      const playerIds = players.map(p => p.id);
      const existingEvaluations = await PlayerEvaluation.findAll({
        where: {
          playerProfileId: playerIds,
          njcaaCoachProfileId: coachProfile.id
        }
      });

      // 🔗 Créer un map des évaluations par joueur pour un accès rapide
      const evaluationMap = new Map();
      existingEvaluations.forEach(evaluation => {
        evaluationMap.set(evaluation.playerProfileId, evaluation);
      });

      // 🎨 Enrichir chaque joueur avec son statut d'évaluation
      const playersWithEvaluationStatus = players.map(player => {
        const evaluation = evaluationMap.get(player.id);
        
        return {
          id: player.id,
          user: player.user,
          profile: {
            dateOfBirth: player.dateOfBirth,
            height: player.height,
            weight: player.weight,
            position: player.position,
            gender: player.gender,
            currentYear: player.currentYear,
            graduationYear: player.graduationYear,
            profileViews: player.profileViews || 0,
            createdAt: player.createdAt
          },
          evaluation: {
            exists: !!evaluation,
            lastEvaluated: evaluation?.evaluationDate || null,
            availableToTransfer: evaluation?.availableToTransfer || null,
            evaluationVersion: evaluation?.evaluationVersion || 0,
            overallScore: evaluation?.overallScore || null
          }
        };
      });

      // 📈 Calculer des statistiques pour le dashboard
      const dashboardStats = {
        totalPlayers: players.length,
        evaluatedPlayers: existingEvaluations.length,
        unevaluatedPlayers: players.length - existingEvaluations.length,
        availableForTransfer: existingEvaluations.filter(e => e.availableToTransfer).length,
        lastEvaluationDate: coachProfile.lastEvaluationDate,
        averageOverallScore: existingEvaluations.length > 0 ? 
          existingEvaluations.reduce((sum, e) => sum + (e.overallScore || 0), 0) / existingEvaluations.length : 0
      };

      console.log(`✅ Dashboard loaded: ${dashboardStats.totalPlayers} players, ${dashboardStats.evaluatedPlayers} evaluated`);

      return res.json({
        status: 'success',
        data: {
          coach: {
            profile: coachProfile.toJSON(),
            college: coachProfile.college,
            user: coachProfile.user
          },
          players: playersWithEvaluationStatus,
          statistics: dashboardStats,
          metadata: {
            lastUpdated: new Date(),
            teamSport: coachProfile.teamSport,
            targetGender: playerGender,
            collegeFilter: coachProfile.collegeId,
            totalAvailable: players.length
          }
        }
      });

    } catch (error) {
      console.error('NJCAA coach dashboard error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to load dashboard',
        code: 'DASHBOARD_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * ⚙️ Page "Settings" - Gestion du profil personnel
   */
  static async getSettings(req, res) {
    try {
      const userId = req.user.id;

      console.log(`⚙️ Loading settings for NJCAA coach: ${req.user.email}`);

      const coachProfile = await NJCAACoachProfile.findOne({
        where: { userId: userId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email', 'createdAt', 'lastLogin']
          },
          {
            model: NJCAACollege,
            as: 'college',
            attributes: ['id', 'name', 'state', 'region', 'division']
          }
        ]
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'NJCAA coach profile not found',
          code: 'COACH_PROFILE_NOT_FOUND'
        });
      }

      // 📊 Calculer quelques statistiques pour l'affichage
      const evaluationStats = {
        totalEvaluations: coachProfile.totalEvaluations || 0,
        lastEvaluationDate: coachProfile.lastEvaluationDate,
        accountCreated: coachProfile.createdAt,
        profileCompleteness: NJCAACoachController.calculateProfileCompleteness(coachProfile)
      };

      console.log(`✅ Settings loaded for coach ${userId}`);

      return res.json({
        status: 'success',
        data: {
          profile: coachProfile.toJSON(),
          user: coachProfile.user,
          college: coachProfile.college,
          statistics: evaluationStats,
          metadata: {
            lastUpdated: new Date(),
            canEdit: ['position', 'phoneNumber'], // Champs modifiables
            readOnly: ['collegeId', 'teamSport', 'division'] // Champs protégés
          }
        }
      });

    } catch (error) {
      console.error('NJCAA coach settings error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to load settings',
        code: 'SETTINGS_ERROR'
      });
    }
  }

  /**
   * 📝 Mise à jour des paramètres du profil coach
   * 
   * SÉCURITÉ : Seuls certains champs peuvent être modifiés par le coach.
   * Les champs critiques comme collegeId et teamSport sont protégés
   * car ils affectent les permissions d'évaluation.
   */
  static async updateSettings(req, res) {
    try {
      const userId = req.user.id;
      const { position, phoneNumber } = req.body;

      console.log(`🔄 Updating settings for NJCAA coach: ${req.user.email}`);

      // Validation des données d'entrée
      if (!position && !phoneNumber) {
        return res.status(400).json({
          status: 'error',
          message: 'At least one field must be provided for update',
          code: 'NO_FIELDS_PROVIDED'
        });
      }

      const coachProfile = await NJCAACoachProfile.findOne({
        where: { userId: userId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'NJCAA coach profile not found',
          code: 'COACH_PROFILE_NOT_FOUND'
        });
      }

      // Préparer les champs à mettre à jour
      const updateFields = {};
      if (position) updateFields.position = position;
      if (phoneNumber) updateFields.phoneNumber = phoneNumber;

      // Effectuer la mise à jour
      await coachProfile.update(updateFields);

      console.log(`✅ Settings updated for coach ${userId}`);

      return res.json({
        status: 'success',
        message: 'Profile settings updated successfully',
        data: {
          updatedFields: Object.keys(updateFields),
          profile: coachProfile.toJSON()
        }
      });

    } catch (error) {
      console.error('NJCAA coach settings update error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update settings',
        code: 'SETTINGS_UPDATE_ERROR'
      });
    }
  }

  /**
   * 🔍 Récupérer l'évaluation existante d'un joueur spécifique
   */
  static async getPlayerEvaluation(req, res) {
    try {
      const { playerId } = req.params;
      const userId = req.user.id;

      console.log(`🔍 Retrieving evaluation for player ${playerId} by coach ${req.user.email}`);

      // Récupérer le profil du coach
      const coachProfile = await NJCAACoachProfile.findOne({
        where: { userId: userId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'NJCAA coach profile not found',
          code: 'COACH_PROFILE_NOT_FOUND'
        });
      }

      // Vérifier que le joueur existe et appartient au même college
      const player = await PlayerProfile.findOne({
        where: { 
          id: playerId,
          collegeId: coachProfile.collegeId // Sécurité : même college seulement
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['firstName', 'lastName', 'email']
          }
        ]
      });

      if (!player) {
        return res.status(404).json({
          status: 'error',
          message: 'Player not found or not in your college',
          code: 'PLAYER_NOT_FOUND'
        });
      }

      // Rechercher l'évaluation existante
      const evaluation = await PlayerEvaluation.findOne({
        where: {
          playerProfileId: playerId,
          njcaaCoachProfileId: coachProfile.id
        }
      });

      if (!evaluation) {
        return res.status(404).json({
          status: 'error',
          message: 'No evaluation found for this player',
          code: 'EVALUATION_NOT_FOUND'
        });
      }

      return res.json({
        status: 'success',
        data: {
          evaluation: evaluation.toJSON(),
          player: {
            id: player.id,
            name: `${player.user.firstName} ${player.user.lastName}`,
            position: player.position,
            year: player.currentYear
          }
        }
      });

    } catch (error) {
      console.error('Get player evaluation error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve player evaluation',
        code: 'GET_EVALUATION_ERROR'
      });
    }
  }

  /**
   * 📊 Évaluation d'un joueur spécifique
   * 
   * ✅ CORRECTION CRITIQUE : Cette méthode retourne maintenant le bon code d'erreur
   * pour correspondre aux attentes des tests
   */
  static async evaluatePlayer(req, res) {
    try {
      const { playerId } = req.params;
      const userId = req.user.id;

      console.log(`📊 Evaluating player ${playerId} by coach ${req.user.email}`);

      // Récupérer le profil du coach
      const coachProfile = await NJCAACoachProfile.findOne({
        where: { userId: userId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'NJCAA coach profile not found',
          code: 'COACH_PROFILE_NOT_FOUND'
        });
      }

      // Vérifier que le joueur existe et appartient au même college
      const player = await PlayerProfile.findOne({
        where: { 
          id: playerId,
          collegeId: coachProfile.collegeId // Sécurité : même college seulement
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['firstName', 'lastName', 'email']
          }
        ]
      });

      if (!player) {
        return res.status(404).json({
          status: 'error',
          message: 'Player not found or not in your college',
          code: 'PLAYER_NOT_FOUND'
        });
      }

      // ✅ CORRECTION CRITIQUE : Vérifier la compatibilité des genres et retourner 
      // le code d'erreur que les tests attendent
      const expectedGender = coachProfile.teamSport === 'mens_soccer' ? 'male' : 'female';
      if (player.gender !== expectedGender) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. You can only evaluate players of the same gender as your team',
          code: 'EVALUATION_ACCESS_DENIED' // ✅ CODE CORRIGÉ POUR LES TESTS
        });
      }

      // Les données d'évaluation sont validées par le middleware validatePlayerEvaluation
      const evaluationData = req.body;

      // Chercher une évaluation existante
      let evaluation = await PlayerEvaluation.findOne({
        where: {
          playerProfileId: playerId,
          njcaaCoachProfileId: coachProfile.id
        }
      });

      if (evaluation) {
        // Mise à jour d'une évaluation existante
        await evaluation.update({
          ...evaluationData,
          evaluationDate: new Date(),
          evaluationVersion: evaluation.evaluationVersion + 1
        });
        console.log(`✅ Updated evaluation for player ${playerId}`);
      } else {
        // Création d'une nouvelle évaluation
        evaluation = await PlayerEvaluation.create({
          ...evaluationData,
          playerProfileId: playerId,
          njcaaCoachProfileId: coachProfile.id,
          evaluationDate: new Date(),
          evaluationVersion: 1
        });
        
        // Mettre à jour les statistiques du coach
        await coachProfile.update({
          totalEvaluations: (coachProfile.totalEvaluations || 0) + 1,
          lastEvaluationDate: new Date()
        });
        
        console.log(`✅ Created new evaluation for player ${playerId}`);
      }

      return res.status(201).json({
        status: 'success',
        message: evaluation.evaluationVersion === 1 ? 'Player evaluation created successfully' : 'Player evaluation updated successfully',
        data: {
          evaluation: evaluation.toJSON(),
          player: {
            id: player.id,
            name: `${player.user.firstName} ${player.user.lastName}`,
            position: player.position,
            year: player.currentYear
          },
          coach: {
            name: `${req.user.firstName} ${req.user.lastName}`,
            college: coachProfile.collegeId
          }
        }
      });

    } catch (error) {
      console.error('Player evaluation error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to evaluate player',
        code: 'EVALUATION_ERROR'
      });
    }
  }

  /**
   * 📋 Historique des évaluations du coach
   */
  static async getEvaluationHistory(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, sortBy = 'evaluationDate', order = 'DESC' } = req.query;

      console.log(`📋 Loading evaluation history for coach: ${req.user.email}`);

      const coachProfile = await NJCAACoachProfile.findOne({
        where: { userId: userId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'NJCAA coach profile not found',
          code: 'COACH_PROFILE_NOT_FOUND'
        });
      }

      // Récupérer l'historique avec pagination
      const offset = (page - 1) * limit;
      const evaluations = await PlayerEvaluation.findAndCountAll({
        where: { njcaaCoachProfileId: coachProfile.id },
        include: [
          {
            model: PlayerProfile,
            as: 'player',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['firstName', 'lastName', 'email']
              }
            ]
          }
        ],
        order: [[sortBy, order.toUpperCase()]],
        limit: parseInt(limit),
        offset: offset
      });

      // Calculer des statistiques sur l'historique
      const historyStats = {
        totalEvaluations: evaluations.count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(evaluations.count / limit),
        averageScore: evaluations.rows.length > 0 ? 
          evaluations.rows.reduce((sum, e) => sum + (e.overallScore || 0), 0) / evaluations.rows.length : 0,
        lastEvaluation: evaluations.rows[0]?.evaluationDate || null
      };

      console.log(`✅ Retrieved ${evaluations.rows.length} evaluations for coach ${userId}`);

      return res.json({
        status: 'success',
        data: {
          evaluations: evaluations.rows,
          pagination: historyStats,
          metadata: {
            lastUpdated: new Date(),
            sortBy: sortBy,
            order: order
          }
        }
      });

    } catch (error) {
      console.error('Evaluation history error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to load evaluation history',
        code: 'HISTORY_ERROR'
      });
    }
  }

  /**
   * 🧮 Méthode utilitaire pour calculer la complétude du profil
   */
  static calculateProfileCompleteness(coachProfile) {
    const requiredFields = ['position', 'phoneNumber', 'collegeId', 'division', 'teamSport'];
    const filledFields = requiredFields.filter(field => 
      coachProfile[field] && coachProfile[field].toString().trim() !== ''
    );
    
    return Math.round((filledFields.length / requiredFields.length) * 100);
  }
}

module.exports = NJCAACoachController;