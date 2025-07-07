// portall/server/controllers/njcaaCoachController.js

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
      const playerGender = coachProfile.teamSport === 'mens_soccer' ? 'male' : 'female';

      // Récupérer les joueurs du même college ET du même genre
      const players = await PlayerProfile.findAll({
        where: {
          collegeId: coachProfile.collegeId,
          gender: playerGender,
          isProfileVisible: true
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email'],
            where: { isActive: true }
          },
          {
            model: NJCAACollege,
            as: 'college',
            attributes: ['name', 'state']
          }
        ],
        order: [
          ['graduationYear', 'ASC'],
          ['currentYear', 'ASC'],
          [{ model: User, as: 'user' }, 'lastName', 'ASC']
        ]
      });

      // Récupérer les évaluations existantes pour ces joueurs
      const playerIds = players.map(p => p.id);
      const existingEvaluations = await PlayerEvaluation.findAll({
        where: {
          playerId: { [Op.in]: playerIds },
          coachId: coachProfile.id,
          isCurrent: true
        }
      });

      // Créer un map pour faciliter la recherche
      const evaluationMap = new Map();
      existingEvaluations.forEach(evaluation => {
        evaluationMap.set(evaluation.playerId, evaluation);
      });

      // Enrichir les données des joueurs avec le statut d'évaluation
      const playersWithEvaluationStatus = players.map(player => {
        const evaluation = evaluationMap.get(player.id);
        return {
          ...player.toJSON(),
          evaluationStatus: {
            hasEvaluation: !!evaluation,
            lastEvaluated: evaluation?.evaluationDate || null,
            availableToTransfer: evaluation?.availableToTransfer || null,
            evaluationVersion: evaluation?.evaluationVersion || 0
          }
        };
      });

      // 📈 Calculer des statistiques pour le dashboard
      const dashboardStats = {
        totalPlayers: players.length,
        evaluatedPlayers: existingEvaluations.length,
        unevaluatedPlayers: players.length - existingEvaluations.length,
        availableForTransfer: existingEvaluations.filter(e => e.availableToTransfer).length,
        lastEvaluationDate: coachProfile.lastEvaluationDate
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
            collegeFilter: coachProfile.collegeId
          }
        }
      });

    } catch (error) {
      console.error('NJCAA coach dashboard error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to load dashboard',
        code: 'DASHBOARD_ERROR'
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
            attributes: ['id', 'name', 'state', 'region']
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

      const activityStats = {
        totalEvaluations: coachProfile.totalEvaluations,
        lastEvaluationDate: coachProfile.lastEvaluationDate,
        accountCreatedDate: coachProfile.user.createdAt,
        lastLoginDate: coachProfile.user.lastLogin
      };

      return res.json({
        status: 'success',
        data: {
          profile: coachProfile.toJSON(),
          user: coachProfile.user,
          college: coachProfile.college,
          activityStats: activityStats,
          editableFields: {
            phoneNumber: true,
            position: false,
            teamSport: false,
            college: false,
            division: false
          }
        }
      });

    } catch (error) {
      console.error('Get settings error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to load settings',
        code: 'SETTINGS_ERROR'
      });
    }
  }

  /**
   * ✏️ Mise à jour des paramètres du profil
   */
  static async updateSettings(req, res) {
    try {
      const userId = req.user.id;
      const updateData = req.body;

      console.log(`✏️ Updating settings for NJCAA coach: ${req.user.email}`);

      const coachProfile = await NJCAACoachProfile.findOne({
        where: { userId: userId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found',
          code: 'COACH_PROFILE_NOT_FOUND'
        });
      }

      const allowedFields = ['phoneNumber'];
      const filteredData = {};
      
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      });

      if (Object.keys(filteredData).length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'No valid fields provided for update',
          code: 'NO_VALID_FIELDS'
        });
      }

      await coachProfile.update(filteredData);

      console.log(`✅ Settings updated successfully for coach ${userId}`);

      return res.json({
        status: 'success',
        message: 'Settings updated successfully',
        data: {
          updatedFields: Object.keys(filteredData),
          profile: coachProfile.toJSON()
        }
      });

    } catch (error) {
      console.error('Update settings error:', error);
      
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
          status: 'error',
          message: 'Validation error in settings data',
          errors: error.errors.map(err => ({
            field: err.path,
            message: err.message
          }))
        });
      }

      return res.status(500).json({
        status: 'error',
        message: 'Failed to update settings',
        code: 'UPDATE_SETTINGS_ERROR'
      });
    }
  }

  /**
   * 📝 Évaluation d'un joueur spécifique
   * 
   * ✅ VERSION CORRIGÉE : Résout tous les problèmes identifiés
   */
  static async evaluatePlayer(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const coachUserId = req.user.id;
      const { playerId } = req.params;
      const evaluationData = req.body;

      console.log(`📝 Creating/updating evaluation for player ${playerId} by coach ${req.user.email}`);

      // ✅ CORRECTION #1 : Utilisation correcte du résultat de validation
      const validationResult = await NJCAACoachController.validateCoachPlayerRelationship(
        coachUserId, 
        playerId, 
        transaction
      );

      if (!validationResult.canEvaluate) {
        await transaction.rollback();
        return res.status(403).json({
          status: 'error',
          message: validationResult.reason,
          code: 'EVALUATION_ACCESS_DENIED' // ✅ CORRECTION #2 : Code d'erreur cohérent avec les tests
        });
      }

      // ✅ CORRECTION #1 (suite) : Extraire les bonnes propriétés
      const { coachProfile, playerProfile } = validationResult;

      // Vérifier si une évaluation existe déjà pour ce joueur
      const existingEvaluation = await PlayerEvaluation.findOne({
        where: {
          playerId: parseInt(playerId),
          coachId: coachProfile.id,
          isCurrent: true
        },
        transaction
      });

      let newEvaluation;

      if (existingEvaluation) {
        // ✅ CORRECTION #3 : Mise à jour sans méthode createNewVersion inexistante
        console.log(`🔄 Updating existing evaluation (version ${existingEvaluation.evaluationVersion})`);
        
        // Marquer l'ancienne évaluation comme non courante
        await existingEvaluation.update({ isCurrent: false }, { transaction });
        
        // Créer une nouvelle version
        newEvaluation = await PlayerEvaluation.create({
          playerId: parseInt(playerId),
          coachId: coachProfile.id,
          ...evaluationData,
          evaluationVersion: existingEvaluation.evaluationVersion + 1,
          isCurrent: true,
          evaluationDate: new Date()
        }, { transaction });
      } else {
        // ✨ Création : première évaluation pour ce joueur
        console.log(`✨ Creating first evaluation for player ${playerId}`);
        newEvaluation = await PlayerEvaluation.create({
          playerId: parseInt(playerId),
          coachId: coachProfile.id,
          ...evaluationData,
          evaluationVersion: 1,
          isCurrent: true,
          evaluationDate: new Date()
        }, { transaction });
      }

      // ✅ CORRECTION #4 : Appel correct sur la bonne instance
      await coachProfile.update({
        totalEvaluations: coachProfile.totalEvaluations + 1,
        lastEvaluationDate: new Date()
      }, { transaction });

      await transaction.commit();

      console.log(`✅ Evaluation completed successfully for player ${playerId}`);

      return res.status(201).json({
        status: 'success',
        message: existingEvaluation ? 'Player evaluation updated successfully' : 'Player evaluation created successfully',
        data: {
          evaluation: newEvaluation.toJSON(),
          player: {
            id: playerProfile.id,
            name: `${playerProfile.user.firstName} ${playerProfile.user.lastName}`,
            college: playerProfile.college?.name
          },
          metadata: {
            version: newEvaluation.evaluationVersion,
            isUpdate: !!existingEvaluation,
            evaluationDate: newEvaluation.evaluationDate
          }
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Player evaluation error:', error);
      
      // Logging détaillé pour le debugging
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create/update player evaluation',
        code: 'EVALUATION_ERROR'
      });
    }
  }

  /**
   * 📖 Récupération d'une évaluation existante
   */
  static async getPlayerEvaluation(req, res) {
    try {
      const coachUserId = req.user.id;
      const { playerId } = req.params;

      console.log(`📖 Retrieving evaluation for player ${playerId} by coach ${req.user.email}`);

      const validationResult = await NJCAACoachController.validateCoachPlayerRelationship(
        coachUserId, 
        playerId
      );

      if (!validationResult.canEvaluate) {
        return res.status(403).json({
          status: 'error',
          message: validationResult.reason,
          code: 'EVALUATION_ACCESS_DENIED'
        });
      }

      const evaluation = await PlayerEvaluation.findOne({
        where: {
          playerId: parseInt(playerId),
          coachId: validationResult.coachProfile.id,
          isCurrent: true
        },
        include: [
          {
            model: PlayerProfile,
            as: 'player',
            include: [{
              model: User,
              as: 'user',
              attributes: ['firstName', 'lastName']
            }]
          }
        ]
      });

      if (!evaluation) {
        return res.status(404).json({
          status: 'error',
          message: 'No evaluation found for this player',
          code: 'EVALUATION_NOT_FOUND'
        });
      }

      console.log(`✅ Evaluation retrieved successfully`);

      return res.json({
        status: 'success',
        data: {
          evaluation: evaluation.toJSON(),
          player: evaluation.player,
          metadata: {
            version: evaluation.evaluationVersion,
            lastUpdated: evaluation.evaluationDate
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
   * 📈 Historique des évaluations effectuées par le coach
   */
  static async getEvaluationHistory(req, res) {
    try {
      const coachUserId = req.user.id;

      const coachProfile = await NJCAACoachProfile.findOne({
        where: { userId: coachUserId }
      });

      if (!coachProfile) {
        return res.status(404).json({
          status: 'error',
          message: 'Coach profile not found',
          code: 'COACH_PROFILE_NOT_FOUND'
        });
      }

      const evaluations = await PlayerEvaluation.findAll({
        where: { coachId: coachProfile.id },
        include: [
          {
            model: PlayerProfile,
            as: 'player',
            include: [{
              model: User,
              as: 'user',
              attributes: ['firstName', 'lastName']
            }]
          }
        ],
        order: [
          ['evaluationDate', 'DESC'],
          ['evaluationVersion', 'DESC']
        ]
      });

      const evaluationsByPlayer = {};
      evaluations.forEach(evaluation => {
        const playerId = evaluation.playerId;
        if (!evaluationsByPlayer[playerId]) {
          evaluationsByPlayer[playerId] = {
            player: evaluation.player,
            evaluations: []
          };
        }
        evaluationsByPlayer[playerId].evaluations.push(evaluation);
      });

      return res.json({
        status: 'success',
        data: {
          totalEvaluations: evaluations.length,
          uniquePlayers: Object.keys(evaluationsByPlayer).length,
          evaluationsByPlayer: evaluationsByPlayer,
          summary: {
            currentEvaluations: evaluations.filter(e => e.isCurrent).length,
            historicalVersions: evaluations.filter(e => !e.isCurrent).length
          }
        }
      });

    } catch (error) {
      console.error('Get evaluation history error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve evaluation history',
        code: 'EVALUATION_HISTORY_ERROR'
      });
    }
  }

  /**
   * 🔍 MÉTHODE UTILITAIRE : Validation de la relation coach-joueur
   */
  static async validateCoachPlayerRelationship(coachUserId, playerId, transaction = null) {
    try {
      // Récupérer le profil du coach
      const coachProfile = await NJCAACoachProfile.findOne({
        where: { userId: coachUserId },
        include: [{
          model: User,
          as: 'user',
          attributes: ['email']
        }],
        transaction
      });

      if (!coachProfile) {
        return {
          canEvaluate: false,
          reason: 'Coach profile not found'
        };
      }

      // Récupérer le profil du joueur
      const playerProfile = await PlayerProfile.findOne({
        where: { id: playerId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['firstName', 'lastName', 'isActive']
          },
          {
            model: NJCAACollege,
            as: 'college',
            attributes: ['name']
          }
        ],
        transaction
      });

      if (!playerProfile) {
        return {
          canEvaluate: false,
          reason: 'Player not found'
        };
      }

      // VALIDATION 1 : Le joueur doit être actif et visible
      if (!playerProfile.user.isActive || !playerProfile.isProfileVisible) {
        return {
          canEvaluate: false,
          reason: 'Player profile is not active or visible'
        };
      }

      // VALIDATION 2 : Même college
      if (playerProfile.collegeId !== coachProfile.collegeId) {
        return {
          canEvaluate: false,
          reason: 'Coach and player must be from the same college'
        };
      }

      // VALIDATION 3 : Genre correspondant à l'équipe du coach
      const expectedGender = coachProfile.teamSport === 'mens_soccer' ? 'male' : 'female';
      if (playerProfile.gender !== expectedGender) {
        return {
          canEvaluate: false,
          reason: `Coach for ${coachProfile.teamSport} can only evaluate ${expectedGender} players`
        };
      }

      // ✅ Toutes les validations passées
      return {
        canEvaluate: true,
        coachProfile: coachProfile,
        playerProfile: playerProfile
      };

    } catch (error) {
      console.error('Validation error:', error);
      return {
        canEvaluate: false,
        reason: 'Validation system error'
      };
    }
  }
}

module.exports = NJCAACoachController;