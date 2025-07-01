// portall/server/controllers/referenceController.js

const { NJCAACollege, NCAACollege } = require('../models');
const { Op } = require('sequelize');

/**
 * Contrôleur pour gérer toutes les données de référence
 * 
 * Ce contrôleur gère les colleges NJCAA et NCAA qui sont utilisés
 * dans les formulaires d'inscription et les recherches.
 */
class ReferenceController {
  /**
   * Récupère la liste complète des colleges NJCAA
   * 
   * Cette méthode est appelée quand un joueur ouvre le formulaire d'inscription.
   * Elle retourne les colleges actifs triés par état puis par nom.
   */
  static async getNJCAAColleges(req, res) {
    try {
      console.log('📚 Fetching NJCAA colleges list');

      // Récupérer tous les colleges NJCAA actifs
      const colleges = await NJCAACollege.findAll({
        where: {
          isActive: true
        },
        attributes: ['id', 'name', 'state', 'region'],
        order: [
          ['state', 'ASC'],
          ['name', 'ASC']
        ]
      });

      // Grouper par état pour faciliter l'affichage frontend
      const collegesByState = colleges.reduce((acc, college) => {
        const state = college.state;
        if (!acc[state]) {
          acc[state] = [];
        }
        acc[state].push({
          id: college.id,
          name: college.name,
          region: college.region
        });
        return acc;
      }, {});

      console.log(`✅ Found ${colleges.length} NJCAA colleges in ${Object.keys(collegesByState).length} states`);

      return res.status(200).json({
        status: 'success',
        message: 'NJCAA colleges retrieved successfully',
        data: {
          colleges: colleges,
          collegesByState: collegesByState,
          meta: {
            totalCount: colleges.length,
            stateCount: Object.keys(collegesByState).length
          }
        }
      });

    } catch (error) {
      console.error('❌ Error fetching NJCAA colleges:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve NJCAA colleges',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * Récupère la liste des colleges NCAA/NAIA
   * 
   * Supporte le filtrage par division via query parameters.
   */
  static async getNCAColleges(req, res) {
    try {
      console.log('🏛️ Fetching NCAA/NAIA colleges list');

      const whereConditions = {
        isActive: true
      };

      // Filtrage optionnel par division
      const { division } = req.query;
      if (division) {
        const validDivisions = ['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia'];
        if (validDivisions.includes(division)) {
          whereConditions.division = division;
          console.log(`🎯 Filtering by division: ${division}`);
        } else {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid division parameter',
            validDivisions: validDivisions
          });
        }
      }

      const colleges = await NCAACollege.findAll({
        where: whereConditions,
        attributes: ['id', 'name', 'state', 'division'],
        order: [
          ['division', 'ASC'],
          ['state', 'ASC'],
          ['name', 'ASC']
        ]
      });

      // Grouper par division pour l'affichage
      const collegesByDivision = colleges.reduce((acc, college) => {
        const div = college.division;
        if (!acc[div]) {
          acc[div] = [];
        }
        acc[div].push({
          id: college.id,
          name: college.name,
          state: college.state
        });
        return acc;
      }, {});

      console.log(`✅ Found ${colleges.length} NCAA/NAIA colleges`);

      return res.status(200).json({
        status: 'success',
        message: 'NCAA/NAIA colleges retrieved successfully',
        data: {
          colleges: colleges,
          collegesByDivision: collegesByDivision,
          meta: {
            totalCount: colleges.length,
            divisionCount: Object.keys(collegesByDivision).length,
            filterApplied: !!division
          }
        }
      });

    } catch (error) {
      console.error('❌ Error fetching NCAA colleges:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve NCAA colleges',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * Récupère les colleges d'une division spécifique
   * 
   * Route optimisée pour quand le coach connaît déjà sa division.
   */
  static async getNCACollegesByDivision(req, res) {
    try {
      const { division } = req.params;
      
      console.log(`🎯 Fetching colleges for division: ${division}`);

      const validDivisions = ['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia'];
      if (!validDivisions.includes(division)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid division specified',
          validDivisions: validDivisions
        });
      }

      const colleges = await NCAACollege.findAll({
        where: {
          division: division,
          isActive: true
        },
        attributes: ['id', 'name', 'state'],
        order: [
          ['state', 'ASC'],
          ['name', 'ASC']
        ]
      });

      console.log(`✅ Found ${colleges.length} colleges in ${division}`);

      return res.status(200).json({
        status: 'success',
        message: `Colleges for ${division} retrieved successfully`,
        data: {
          colleges: colleges,
          division: division,
          count: colleges.length
        }
      });

    } catch (error) {
      console.error(`❌ Error fetching colleges for division ${req.params.division}:`, error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve colleges for division',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * Crée un nouveau college NJCAA (admin seulement)
   */
  static async createNJCAACollege(req, res) {
    try {
      const { name, state, region } = req.body;

      console.log(`🏫 Creating new NJCAA college: ${name}`);

      // Validation des données
      if (!name || !state || !region) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required fields: name, state, region'
        });
      }

      // Vérifier si le college existe déjà
      const existingCollege = await NJCAACollege.findOne({
        where: { name: name.trim() }
      });

      if (existingCollege) {
        return res.status(409).json({
          status: 'error',
          message: 'College with this name already exists'
        });
      }

      // Créer le nouveau college
      const newCollege = await NJCAACollege.create({
        name: name.trim(),
        state: state.toUpperCase(),
        region: region,
        isActive: true
      });

      console.log(`✅ NJCAA college created successfully: ${newCollege.name} (ID: ${newCollege.id})`);

      return res.status(201).json({
        status: 'success',
        message: 'NJCAA college created successfully',
        data: {
          college: newCollege
        }
      });

    } catch (error) {
      console.error('❌ Error creating NJCAA college:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create NJCAA college',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * Met à jour un college NJCAA existant (admin seulement)
   */
  static async updateNJCAACollege(req, res) {
    try {
      const { id } = req.params;
      const { name, state, region, isActive } = req.body;

      console.log(`🔄 Updating NJCAA college ID: ${id}`);

      const college = await NJCAACollege.findByPk(id);
      if (!college) {
        return res.status(404).json({
          status: 'error',
          message: 'College not found'
        });
      }

      // Mettre à jour les champs fournis
      const updateData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (state !== undefined) updateData.state = state.toUpperCase();
      if (region !== undefined) updateData.region = region;
      if (isActive !== undefined) updateData.isActive = isActive;

      await college.update(updateData);

      console.log(`✅ NJCAA college updated successfully: ${college.name}`);

      return res.status(200).json({
        status: 'success',
        message: 'NJCAA college updated successfully',
        data: {
          college: college
        }
      });

    } catch (error) {
      console.error('❌ Error updating NJCAA college:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update NJCAA college',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }

  /**
   * Crée un nouveau college NCAA (admin seulement)
   */
  static async createNCAACollege(req, res) {
    try {
      const { name, state, division } = req.body;

      console.log(`🏛️ Creating new NCAA college: ${name}`);

      // Validation des données
      if (!name || !state || !division) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required fields: name, state, division'
        });
      }

      const validDivisions = ['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia'];
      if (!validDivisions.includes(division)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid division',
          validDivisions: validDivisions
        });
      }

      // Vérifier si le college existe déjà
      const existingCollege = await NCAACollege.findOne({
        where: { name: name.trim() }
      });

      if (existingCollege) {
        return res.status(409).json({
          status: 'error',
          message: 'College with this name already exists'
        });
      }

      // Créer le nouveau college
      const newCollege = await NCAACollege.create({
        name: name.trim(),
        state: state.toUpperCase(),
        division: division,
        isActive: true
      });

      console.log(`✅ NCAA college created successfully: ${newCollege.name} (ID: ${newCollege.id})`);

      return res.status(201).json({
        status: 'success',
        message: 'NCAA college created successfully',
        data: {
          college: newCollege
        }
      });

    } catch (error) {
      console.error('❌ Error creating NCAA college:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create NCAA college',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }
  }
}

module.exports = ReferenceController;