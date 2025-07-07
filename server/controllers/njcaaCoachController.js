// portall/server/controllers/njcaaCoachController.js

const { User, PlayerProfile, NJCAACoachProfile, PlayerEvaluation, NJCAACollege } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database.connection');

/**
 * Contrôleur pour la gestion des coachs NJCAA avec leurs fonctionnalités spécialisées
 * 
 * ARCHITECTURE MÉTIER : Ce contrôleur gère un workflow complètement différent
 * des autres types d'utilisateurs. Les coachs NJCAA ne payent pas d'abonnement
 * et ne recherchent pas de joueurs. Leur rôle principal est d'évaluer leurs
 * propres joueurs pour aider les coachs NCAA/NAIA dans leur recrutement.
 * 
 * Fonctionnalités principales :
 * 1. Dashboard avec liste de leurs joueurs
 * 2. Système d'évaluation des joueurs
 * 3. Historique des évaluations effectuées
 * 4. Gestion du profil personnel
 * 
 * Cette séparation claire des responsabilités facilite la maintenance
 * et l'évolution future de chaque type d'utilisateur.
 */
class NJCAACoachController {
  /**
   * 📊 Dashboard principal du coach NJCAA - Page "Main Page"
   * 
   * Cette méthode implémente la page principale selon tes spécifications :
   * - Liste des joueurs de son college et de son genre d'équipe
   * - Mise à jour dynamique quand de nouveaux joueurs s'inscrivent
   * - Interface pour évaluer directement les joueurs
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

      // LOGIQUE CRUCIALE : Déterminer le genre des joueurs selon l'équipe du coach
      // Cette logique implémente la règle métier fondamentale : correspondance genre coach-joueurs
      const playerGender = coachProfile.teamSport === 'mens_soccer' ? 'male' : 'female';
      
      console.log(`🎯 Coach manages ${coachProfile.teamSport}, looking for ${playerGender} players`);

      // Récupération des joueurs correspondant aux critères du coach
      // Cette requête implémente l'actualisation dynamique que tu as spécifiée
      const myPlayers = await PlayerProfile.findAll({
        where: {
          collegeId: coachProfile.collegeId, // Même college
          gender: playerGender, // Même genre que l'équipe du coach
          isProfileVisible: true // Seulement les profils actifs et validés
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email', 'isActive', 'createdAt'],
            where: { isActive: true } // Seulement les utilisateurs actifs
          }
        ],
        order: [
          ['created_at', 'DESC'], // Les nouveaux joueurs en premier
          ['updated_at', 'DESC']
        ]
      });

      // Récupération des évaluations existantes pour ces joueurs
      // Ceci permet d'afficher l'état d'avancement des évaluations
      const playerIds = myPlayers.map(player => player.id);
      const existingEvaluations = await PlayerEvaluation.findAll({
        where: {
          playerId: { [Op.in]: playerIds },
          coachId: coachProfile.id,
          isCurrent: true // Seulement les évaluations actuelles
        },
        attributes: ['playerId', 'evaluationDate', 'availableToTransfer']
      });

      // Créer un mapping pour optimiser l'affichage côté client
      const evaluationMap = {};
      existingEvaluations.forEach(evaluation => {
        evaluationMap[evaluation.playerId] = {
          hasEvaluation: true,
          evaluationDate: evaluation.evaluationDate,
          availableToTransfer: evaluation.availableToTransfer
        };
      });

      // Enrichir les données des joueurs avec leur statut d'évaluation
      const playersWithEvaluationStatus = myPlayers.map(player => ({
        ...player.toJSON(),
        evaluationStatus: evaluationMap[player.id] || {
          hasEvaluation: false,
          evaluationDate: null,
          availableToTransfer: null
        }
      }));

      // Calculer des statistiques utiles pour le dashboard
      const dashboardStats = {
        totalPlayers: myPlayers.length,
        evaluatedPlayers: existingEvaluations.length,
        pendingEvaluations: myPlayers.length - existingEvaluations.length,
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
   * 📝 Évaluation d'un joueur spécifique
   * 
   * Cette méthode implémente le cœur de la fonctionnalité métier des coachs NJCAA.
   * Elle permet de créer ou mettre à jour l'évaluation d'un joueur selon
   * les critères que tu as spécifiés.
   * 
   * IMPORTANT : Cette méthode gère le versioning automatique des évaluations,
   * permettant de conserver un historique tout en marquant la plus récente.
   */
  static async evaluatePlayer(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const coachUserId = req.user.id;
      const { playerId } = req.params;
      const evaluationData = req.body;

      console.log(`📝 Creating/updating evaluation for player ${playerId} by coach ${req.user.email}`);

      // Vérification des droits : le coach peut-il évaluer ce joueur ?
      const coachProfile = await NJCAACoachController.validateCoachPlayerRelationship(
        coachUserId, 
        playerId, 
        transaction
      );

      if (!coachProfile.canEvaluate) {
        await transaction.rollback();
        return res.status(403).json({
          status: 'error',
          message: coachProfile.reason,
          code: 'EVALUATION_NOT_AUTHORIZED'
        });
      }

      // Vérifier si une évaluation existe déjà pour ce joueur
      const existingEvaluation = await PlayerEvaluation.findOne({
        where: {
          playerId: parseInt(playerId),
          coachId: coachProfile.id,
          isCurrent: true
        },
        transaction
      });

      let evaluation;

      if (existingEvaluation) {
        // Mise à jour : créer une nouvelle version
        console.log(`🔄 Updating existing evaluation (creating new version)`);
        evaluation = await existingEvaluation.createNewVersion(evaluationData, transaction);
      } else {
        // Nouvelle évaluation
        console.log(`✨ Creating new evaluation`);
        evaluation = await PlayerEvaluation.create({
          playerId: parseInt(playerId),
          coachId: coachProfile.id,
          ...evaluationData,
          evaluationVersion: 1,
          isCurrent: true,
          evaluationDate: new Date()
        }, { transaction });
      }

      // Mettre à jour les statistiques du coach
      await coachProfile.incrementEvaluations();

      await transaction.commit();

      console.log(`✅ Evaluation completed successfully (ID: ${evaluation.id})`);

      return res.status(existingEvaluation ? 200 : 201).json({
        status: 'success',
        message: existingEvaluation ? 'Player evaluation updated successfully' : 'Player evaluation created successfully',
        data: {
          evaluation: evaluation.toJSON(),
          isNewEvaluation: !existingEvaluation,
          version: evaluation.evaluationVersion
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Player evaluation error:', error);
      
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
          status: 'error',
          message: 'Validation error in evaluation data',
          errors: error.errors.map(err => ({
            field: err.path,
            message: err.message
          }))
        });
      }

      return res.status(500).json({
        status: 'error',
        message: 'Failed to save player evaluation',
        code: 'EVALUATION_ERROR'
      });
    }
  }

  /**
   * 📖 Récupération d'une évaluation existante
   * 
   * Cette méthode permet au coach de consulter l'évaluation actuelle
   * d'un de ses joueurs, utile pour pré-remplir le formulaire d'évaluation.
   */
  static async getPlayerEvaluation(req, res) {
    try {
      const coachUserId = req.user.id;
      const { playerId } = req.params;

      console.log(`📖 Retrieving evaluation for player ${playerId} by coach ${req.user.email}`);

      // Vérifier que le coach a le droit de voir cette évaluation
      const coachProfile = await NJCAACoachController.validateCoachPlayerRelationship(
        coachUserId, 
        playerId
      );

      if (!coachProfile.canEvaluate) {
        return res.status(403).json({
          status: 'error',
          message: coachProfile.reason,
          code: 'EVALUATION_ACCESS_DENIED'
        });
      }

      // Récupérer l'évaluation actuelle
      const evaluation = await PlayerEvaluation.findOne({
        where: {
          playerId: parseInt(playerId),
          coachId: coachProfile.id,
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
   * 📊 Page "Settings" - Gestion du profil personnel
   * 
   * Cette méthode implémente la deuxième page du dashboard selon tes spécifications.
   * Elle permet au coach de gérer ses paramètres de compte.
   */
  static async getSettings(req, res) {
    try {
      const userId = req.user.id;

      console.log(`⚙️ Loading settings for NJCAA coach: ${req.user.email}`);

      // Récupérer le profil complet avec toutes les informations
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

      // Calculer des statistiques d'activité pour la page settings
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
            // Champs que le coach peut modifier dans les settings
            phoneNumber: true,
            position: false, // Nécessite validation admin
            teamSport: false, // Nécessite validation admin
            college: false, // Nécessite validation admin
            division: false // Nécessite validation admin
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
   * 
   * Permet au coach de modifier certains champs de son profil.
   * Certains champs nécessitent une validation admin et ne sont pas modifiables ici.
   */
  static async updateSettings(req, res) {
    try {
      const userId = req.user.id;
      const updateData = req.body;

      console.log(`✏️ Updating settings for NJCAA coach: ${req.user.email}`);

      // Récupérer le profil actuel
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

      // Filtrer les champs modifiables (sécurité)
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

      // Effectuer la mise à jour
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
   * 🔍 MÉTHODE UTILITAIRE : Validation de la relation coach-joueur
   * 
   * Cette méthode critique vérifie qu'un coach NJCAA a le droit d'évaluer
   * un joueur spécifique. Elle implémente les règles métier de sécurité.
   * 
   * RÈGLES MÉTIER :
   * 1. Le coach et le joueur doivent être du même college
   * 2. Le genre du joueur doit correspondre à l'équipe du coach
   * 3. Le joueur doit avoir un profil actif et visible
   */
  static async validateCoachPlayerRelationship(coachUserId, playerId, transaction = null) {
    try {
      // Récupérer le profil du coach
      const coachProfile = await NJCAACoachProfile.findOne({
        where: { userId: coachUserId },
        transaction
      });

      if (!coachProfile) {
        return {
          canEvaluate: false,
          reason: 'Coach profile not found',
          id: null
        };
      }

      // Récupérer le profil du joueur avec ses relations
      const playerProfile = await PlayerProfile.findByPk(playerId, {
        include: [{
          model: User,
          as: 'user',
          attributes: ['isActive']
        }],
        transaction
      });

      if (!playerProfile) {
        return {
          canEvaluate: false,
          reason: 'Player profile not found',
          id: coachProfile.id
        };
      }

      // Vérifier que le joueur est actif
      if (!playerProfile.user.isActive || !playerProfile.isProfileVisible) {
        return {
          canEvaluate: false,
          reason: 'Player profile is not active or visible',
          id: coachProfile.id
        };
      }

      // RÈGLE MÉTIER CRUCIALE : Même college
      if (playerProfile.collegeId !== coachProfile.collegeId) {
        return {
          canEvaluate: false,
          reason: 'Coach and player are not from the same college',
          id: coachProfile.id
        };
      }

      // RÈGLE MÉTIER CRUCIALE : Correspondance genre
      const expectedGender = coachProfile.teamSport === 'mens_soccer' ? 'male' : 'female';
      if (playerProfile.gender !== expectedGender) {
        return {
          canEvaluate: false,
          reason: `Coach manages ${coachProfile.teamSport} but player is ${playerProfile.gender}`,
          id: coachProfile.id
        };
      }

      // Toutes les vérifications passées
      return {
        canEvaluate: true,
        reason: 'Validation successful',
        id: coachProfile.id,
        coachProfile: coachProfile,
        playerProfile: playerProfile
      };

    } catch (error) {
      console.error('Coach-player relationship validation error:', error);
      return {
        canEvaluate: false,
        reason: 'Validation error occurred',
        id: null
      };
    }
  }

  /**
   * 📈 Historique des évaluations effectuées par le coach
   * 
   * Cette méthode optionnelle permet au coach de voir toutes ses évaluations
   * passées, utile pour le suivi et les rapports.
   */
  static async getEvaluationHistory(req, res) {
    try {
      const coachUserId = req.user.id;

      // Récupérer le profil du coach
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

      // Récupérer toutes les évaluations du coach (actuelles et historiques)
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

      // Grouper par joueur pour un affichage plus clair
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
}

module.exports = NJCAACoachController;