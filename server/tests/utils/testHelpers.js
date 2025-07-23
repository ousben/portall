// portall/server/tests/utils/testHelpers.js

const { User, PlayerProfile, CoachProfile, NJCAACoachProfile, NJCAACollege, NCAACollege } = require('../../models');
const AuthService = require('../../services/authService');
const bcrypt = require('bcryptjs');

/**
 * 🧰 Utilitaires de tests pour Portall - Phase 5A & 5B
 * 
 * Cette boîte à outils centralisée simplifie la création de données de test
 * et standardise les patterns d'assertion pour tous vos tests. Pensez à ce
 * fichier comme votre "assistant personnel" pour l'écriture de tests.
 * 
 * 🎯 Philosophie de conception :
 * Au lieu de dupliquer la logique de création d'utilisateurs dans chaque test,
 * ces helpers encapsulent les patterns communs et garantissent la cohérence.
 * C'est un exemple parfait du principe DRY (Don't Repeat Yourself) appliqué aux tests.
 * 
 * 💡 Concept pédagogique : "Test Data Builders"
 * Ces fonctions suivent le pattern Builder qui permet de créer des objets
 * complexes étape par étape, avec des valeurs par défaut sensées et la
 * possibilité de personnaliser seulement ce qui est nécessaire pour chaque test.
 */

class TestHelpers {
  /**
   * 🏗️ Factory pour créer des colleges NJCAA de test
   * 
   * Cette fonction illustre le concept de "Test Data Factory" - une approche
   * qui génère des données de test valides avec des paramètres raisonnables
   * par défaut, tout en permettant la personnalisation pour des cas spécifiques.
   */
  static async createTestNJCAACollege(overrides = {}) {
    const defaultData = {
      name: `Test NJCAA College ${Date.now()}`,
      state: 'CA',
      region: 'West',
      division: 'division_1',
      website: 'https://test-college.edu',
      isActive: true,
      ...overrides
    };

    return await NJCAACollege.create(defaultData);
  }

  /**
   * 🏛️ Factory pour créer des colleges NCAA de test
   */
  static async createTestNCAACollege(overrides = {}) {
    const defaultData = {
      name: `Test NCAA College ${Date.now()}`,
      state: 'FL',
      division: 'ncaa_d1',
      conference: 'Test Conference',
      website: 'https://test-ncaa.edu',
      isActive: true,
      ...overrides
    };

    return await NCAACollege.create(defaultData);
  }

  /**
   * 👤 Factory pour créer un utilisateur joueur complet avec profil
   * 
   * Cette fonction démontre comment créer des objets avec des relations
   * complexes en une seule opération. Elle encapsule la logique métier
   * de création d'un compte joueur, incluant la validation et l'association
   * avec un college NJCAA.
   */
  static async createTestPlayer(overrides = {}) {
    // Créer un college si non fourni
    let college = overrides.college;
    if (!college) {
      college = await this.createTestNJCAACollege();
    }

    // Données par défaut pour l'utilisateur
    const userData = {
      email: `player.${Date.now()}@test.com`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'Player',
      userType: 'player',
      isActive: true,
      ...overrides.user
    };

    // Créer l'utilisateur de base
    const user = await User.create(userData);

    // Données par défaut pour le profil joueur
    const profileData = {
      userId: user.id,
      dateOfBirth: new Date('2003-01-15'),
      height: 175,
      weight: 70,
      position: 'midfielder',
      gender: 'male',
      collegeId: college.id,
      currentYear: 'freshman',
      graduationYear: 2026,
      gpa: 3.5,
      isProfileVisible: true,
      ...overrides.profile
    };

    // Créer le profil joueur
    const profile = await PlayerProfile.create(profileData);

    return {
      user,
      profile,
      college,
      // Méthode helper pour générer un token JWT
      getAuthToken: () => AuthService.generateToken(user)
    };
  }

  /**
   * 🏟️ Factory pour créer un coach NCAA/NAIA complet
   */
  static async createTestCoach(overrides = {}) {
    let college = overrides.college;
    if (!college) {
      college = await this.createTestNCAACollege();
    }

    const userData = {
      email: `coach.${Date.now()}@test.com`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'Coach',
      userType: 'coach',
      isActive: true,
      ...overrides.user
    };

    const user = await User.create(userData);

    const profileData = {
      userId: user.id,
      position: 'head_coach',
      phoneNumber: '+1234567890',
      collegeId: college.id,
      division: college.division,
      teamSport: 'mens_soccer',
      yearsExperience: 5,
      ...overrides.profile
    };

    const profile = await CoachProfile.create(profileData);

    return {
      user,
      profile,
      college,
      getAuthToken: () => AuthService.generateToken(user)
    };
  }

  /**
   * 🏟️ Factory pour créer un coach NJCAA complet (nouveau en Phase 5B)
   * 
   * Cette fonction illustre comment étendre votre système de tests pour
   * supporter de nouveaux types d'utilisateurs. Le pattern reste identique
   * mais les données spécifiques changent selon le type.
   */
  static async createTestNJCAACoach(overrides = {}) {
    let college = overrides.college;
    if (!college) {
      college = await this.createTestNJCAACollege();
    }

    const userData = {
      email: `njcaa.coach.${Date.now()}@test.com`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'NJCAACoach',
      userType: 'njcaa_coach',
      isActive: true,
      ...overrides.user
    };

    const user = await User.create(userData);

    const profileData = {
      userId: user.id,
      position: 'head_coach',
      phoneNumber: '+1234567890',
      collegeId: college.id,
      division: 'njcaa_d1',
      teamSport: 'mens_soccer',
      totalEvaluations: 0,
      lastEvaluationDate: null,
      ...overrides.profile
    };

    const profile = await NJCAACoachProfile.create(profileData);

    return {
      user,
      profile,
      college,
      getAuthToken: () => AuthService.generateToken(user)
    };
  }

  /**
   * 👨‍💼 Factory pour créer un administrateur
   */
  static async createTestAdmin(overrides = {}) {
    const userData = {
      email: `admin.${Date.now()}@test.com`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'Admin',
      userType: 'admin',
      isActive: true,
      ...overrides
    };

    const user = await User.create(userData);

    return {
      user,
      getAuthToken: () => AuthService.generateToken(user)
    };
  }

  /**
   * 🧹 Nettoyage des données de test
   * 
   * Cette fonction illustre l'importance du nettoyage entre les tests
   * pour maintenir l'isolation. Sans cela, les tests pourraient s'influencer
   * mutuellement et produire des résultats imprévisibles.
   */
  static async cleanupTestData() {
    // Supprimer dans l'ordre pour respecter les contraintes de clés étrangères
    await PlayerProfile.destroy({ where: {}, force: true });
    await CoachProfile.destroy({ where: {}, force: true });
    await NJCAACoachProfile.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });
    await NJCAACollege.destroy({ where: {}, force: true });
    await NCAACollege.destroy({ where: {}, force: true });
  }

  /**
   * 🎭 Helper pour simuler des requêtes HTTP authentifiées
   * 
   * Cette fonction encapsule la logique de création d'headers d'auth
   * JWT pour vos tests d'intégration. Elle évite la duplication du
   * code d'authentification dans chaque test de route.
   */
  static getAuthHeaders(token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * ✅ Assertions personnalisées pour les réponses API
   * 
   * Ces helpers standardisent vos assertions et rendent vos tests
   * plus lisibles en encapsulant la logique de vérification commune.
   */
  static expectSuccessResponse(response, expectedStatus = 200) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('status', 'success');
    expect(response.body).toHaveProperty('data');
  }

  static expectErrorResponse(response, expectedStatus = 400) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('status', 'error');
    expect(response.body).toHaveProperty('message');
  }

  static expectValidJWTResponse(response) {
    this.expectSuccessResponse(response);
    expect(response.body.data).toHaveProperty('tokens');
    expect(response.body.data.tokens).toHaveProperty('accessToken');
    expect(response.body.data.tokens).toHaveProperty('refreshToken');
    expect(response.body.data).toHaveProperty('user');
  }

  /**
   * 🔐 Helper pour valider la structure d'un utilisateur dans les réponses
   */
  static expectValidUserStructure(user) {
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('firstName');
    expect(user).toHaveProperty('lastName');
    expect(user).toHaveProperty('userType');
    expect(user).toHaveProperty('isActive');
    expect(user).toHaveProperty('createdAt');
    
    // Vérifier que les données sensibles ne sont pas exposées
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('resetPasswordToken');
  }

  /**
   * 📊 Helper pour valider la structure d'un profil selon le type
   */
  static expectValidProfileStructure(profile, userType) {
    expect(profile).toHaveProperty('id');
    expect(profile).toHaveProperty('userId');
    expect(profile).toHaveProperty('createdAt');

    switch (userType) {
      case 'player':
        expect(profile).toHaveProperty('dateOfBirth');
        expect(profile).toHaveProperty('height');
        expect(profile).toHaveProperty('position');
        expect(profile).toHaveProperty('collegeId');
        break;
      
      case 'coach':
        expect(profile).toHaveProperty('position');
        expect(profile).toHaveProperty('phoneNumber');
        expect(profile).toHaveProperty('collegeId');
        expect(profile).toHaveProperty('division');
        break;
      
      case 'njcaa_coach':
        expect(profile).toHaveProperty('position');
        expect(profile).toHaveProperty('phoneNumber');
        expect(profile).toHaveProperty('collegeId');
        expect(profile).toHaveProperty('totalEvaluations');
        break;
    }
  }

  /**
   * ⏱️ Helper pour attendre une condition avec timeout
   * 
   * Utile pour les tests asynchrones où vous devez attendre qu'une
   * condition soit remplie (par exemple, mise à jour en base de données).
   */
  static async waitForCondition(conditionFn, timeout = 5000) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (await conditionFn()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  /**
   * 📝 Helper pour créer des données de test avec des valeurs réalistes
   * 
   * Cette fonction génère des données qui ressemblent à de vraies données
   * utilisateur, ce qui aide à identifier les problèmes qui pourraient
   * survenir en production.
   */
  static generateRealisticTestData() {
    const timestamp = Date.now();
    
    return {
      player: {
        email: `john.smith.${timestamp}@njcaa-college.edu`,
        firstName: 'John',
        lastName: 'Smith',
        dateOfBirth: new Date('2004-03-15'),
        height: 178,
        weight: 72,
        position: 'midfielder',
        gpa: 3.2
      },
      coach: {
        email: `coach.johnson.${timestamp}@university.edu`,
        firstName: 'Michael',
        lastName: 'Johnson',
        phoneNumber: '+1-555-123-4567',
        position: 'head_coach',
        yearsExperience: 8
      },
      njcaaCoach: {
        email: `coach.williams.${timestamp}@njcaa-college.edu`,
        firstName: 'Sarah',
        lastName: 'Williams',
        phoneNumber: '+1-555-987-6543',
        position: 'assistant_coach'
      }
    };
  }
}

module.exports = TestHelpers;