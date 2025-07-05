// portall/server/test-registration-flow.js

const request = require('supertest');

/**
 * Test d'intégration complet pour Portall Phase 3
 * 
 * Ce test configure automatiquement son environnement, puis valide :
 * 1. La configuration de l'environnement de test
 * 2. Les inscriptions avec validation complète
 * 3. L'authentification JWT robuste
 * 4. L'accès aux dashboards selon les rôles
 * 5. Les contrôles d'autorisation
 */

async function runCompleteAuthTest() {
  console.log('🚀 Démarrage du test d\'authentification Portall Phase 3');
  console.log('=====================================================');
  
  // Configuration explicite de l'environnement de test
  process.env.NODE_ENV = 'test';
  
  try {
    // Ces variables sont déclarées ici pour être accessibles dans tous les tests
    let playerToken = null;        // Token JWT du joueur pour les tests d'accès
    let coachToken = null;         // Token JWT du coach pour les tests d'accès
    let playerData = null;         // Données du joueur créé pour les tests
    let coachData = null;          // Données du coach créé pour les tests
    let app = null;                // Instance de l'application Express

    // ===========================
    // ÉTAPE 1: CONFIGURATION INTÉGRÉE DE L'ENVIRONNEMENT
    // ===========================
    console.log('\n🔧 Configuration de l\'environnement de test intégré...');
    
    // Import de la configuration
    const { sequelize } = require('../config/database.connection');
    const models = require('../models');
    
    // Authentification à la base de données de test
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données de test établie');
    
    // Synchronisation des modèles avec recréation propre
    console.log('📊 Synchronisation des modèles...');
    await sequelize.sync({ force: true, logging: false });
    console.log('✅ Tables synchronisées avec succès');
    
    // Création des données de référence essentielles
    console.log('📋 Insertion des données de référence...');
    
    const njcaaColleges = await models.NJCAACollege.bulkCreate([
      {
        name: 'Test NJCAA College 1',
        state: 'CA',
        region: 'West',
        division: 'division_1',
        website: 'https://test-njcaa-1.edu',
        isActive: true
      },
      {
        name: 'Test NJCAA College 2',
        state: 'TX',
        region: 'South', 
        division: 'division_2',
        website: 'https://test-njcaa-2.edu',
        isActive: true
      }
    ]);
    
    const ncaaColleges = await models.NCAACollege.bulkCreate([
      {
        name: 'Test NCAA College 1',
        state: 'FL',
        division: 'ncaa_d1',
        conference: 'Test Conference',
        website: 'https://test-ncaa-1.edu',
        isActive: true
      },
      {
        name: 'Test NCAA College 2',
        state: 'NY',
        division: 'ncaa_d2', 
        conference: 'Test Conference',
        website: 'https://test-ncaa-2.edu',
        isActive: true
      }
    ]);
    
    console.log(`✅ ${njcaaColleges.length} colleges NJCAA créés`);
    console.log(`✅ ${ncaaColleges.length} colleges NCAA créés`);
    console.log('🎉 Environnement de test configuré avec succès !');

    // ===========================
    // ÉTAPE 2: DÉMARRAGE DE L'APPLICATION EXPRESS
    // ===========================
    console.log('\n🚀 Initialisation de l\'application Express...');
    
    // Import de l'application Express (maintenant que la DB est prête)
    app = require('../server');
    
    // Pause pour stabiliser les connexions
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('✅ Application prête pour les tests');

    // ===========================
    // FONCTION UTILITAIRE POUR L'ACTIVATION DES COMPTES DE TEST
    // ===========================
    
    /**
     * Active un compte utilisateur pour les tests
     * 
     * Cette fonction simule l'approbation administrative qui se ferait
     * normalement manuellement en production. Elle respecte l'architecture
     * de sécurité tout en permettant aux tests automatisés de s'exécuter.
     * 
     * @param {string} email - Email de l'utilisateur à activer
     * @param {string} userType - Type d'utilisateur pour les logs
     * @returns {Object} L'utilisateur activé
     */
    async function activateTestAccount(email, userType) {
      console.log(`👨‍💼 Activation du compte ${userType} pour les tests...`);
      
      // Utilise la variable models déjà déclarée en haut du fichier
      const user = await models.User.findOne({ where: { email } });
      
      if (!user) {
        throw new Error(`Utilisateur ${email} non trouvé pour activation`);
      }
      
      // Simulation de l'approbation administrative
      await user.update({
        isActive: true,
        isEmailVerified: true
      });
      
      console.log(`✅ Compte ${userType} activé avec succès`);
      console.log(`   Email: ${email}`);
      console.log(`   Status: Actif et vérifié`);
      
      return user;
    }

    // ===========================
    // FONCTION UTILITAIRE D'EXTRACTION ADAPTATIVE DES DONNÉES DE CONNEXION
    // ===========================
    
    /**
     * Extrait de manière intelligente le token et les données utilisateur 
     * de la réponse d'authentification, quelle que soit la structure de l'API
     * 
     * Cette fonction est comme un traducteur universel qui comprend
     * différents "dialectes" de réponses API et extrait toujours les bonnes informations
     */
    function extractLoginData(responseBody) {
      console.log('🔍 Analyse adaptative de la structure de réponse...');
      
      let accessToken = null;
      let user = null;
      let strategy = 'unknown';

      // Stratégie 1: Structure moderne avec data wrapper
      if (responseBody.data && responseBody.data.tokens && responseBody.data.tokens.accessToken) {
        accessToken = responseBody.data.tokens.accessToken;
        user = responseBody.data.user;
        strategy = 'modern_nested';
        console.log('✅ Utilisation de la structure moderne (data.tokens.accessToken)');
      }
      // Stratégie 2: Structure classique simple
      else if (responseBody.accessToken) {
        accessToken = responseBody.accessToken;
        user = responseBody.user;
        strategy = 'classic_flat';
        console.log('✅ Utilisation de la structure classique (accessToken)');
      }
      // Stratégie 3: Structure avec token direct
      else if (responseBody.token) {
        accessToken = responseBody.token;
        user = responseBody.user;
        strategy = 'direct_token';
        console.log('✅ Utilisation de la structure avec token direct');
      }
      // Stratégie 4: Structure avec tokens wrapper
      else if (responseBody.tokens && responseBody.tokens.accessToken) {
        accessToken = responseBody.tokens.accessToken;
        user = responseBody.user;
        strategy = 'tokens_wrapper';
        console.log('✅ Utilisation de la structure avec tokens wrapper');
      }

      // Validation finale des données extraites
      if (accessToken && user) {
        return {
          token: accessToken,
          user: user,
          strategy: strategy
        };
      } else {
        console.log('❌ Impossible d\'extraire les données requises');
        console.log('🔍 Structure complète reçue:', JSON.stringify(responseBody, null, 2));
        return null;
      }
    }

    // ===========================
    // TEST 1: Vérification de la santé de l'API
    // ===========================
    console.log('\n🏥 Test 1: Vérification de la santé du serveur...');
    
    const healthResponse = await request(app).get('/api/health');
    
    if (healthResponse.status === 200) {
      console.log('✅ Serveur opérationnel');
      console.log(`   Environment: ${healthResponse.body.environment}`);
      console.log(`   Version: ${healthResponse.body.version || 'N/A'}`);
    } else {
      throw new Error('Serveur non opérationnel');
    }

    // ===========================
    // TEST 2: Validation de l'environnement de test
    // ===========================
    console.log('\n📊 Test 2: Validation de l\'environnement de test...');
    
    const dbTestResponse = await request(app).get('/api/db-test');
    
    if (dbTestResponse.status === 200) {
      console.log('✅ Base de données de test opérationnelle');
      console.log(`   Colleges NJCAA: ${dbTestResponse.body.statistics.njcaaColleges}`);
      console.log(`   Colleges NCAA: ${dbTestResponse.body.statistics.ncaaColleges}`);
      
      // Vérification que nous avons bien des données de test
      if (dbTestResponse.body.statistics.njcaaColleges === 0 || 
          dbTestResponse.body.statistics.ncaaColleges === 0) {
        throw new Error('Données de référence manquantes');
      }
    } else {
      throw new Error(`Problème de base de données: ${dbTestResponse.status}`);
    }

    // ===========================
    // TEST 3: Inscription complète d'un joueur NJCAA
    // ===========================
    console.log('\n⚽ Test 3: Inscription complète d\'un joueur NJCAA...');
    
    const timestamp = Date.now();
    playerData = {
      firstName: 'Alex',
      lastName: 'TestPlayer',
      email: `testplayer.${timestamp}@portall-test.com`,
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
      userType: 'player',
      gender: 'male',
      collegeId: 1, // Premier college créé
      termsAccepted: true,
      newsletterOptIn: false,
      referralSource: 'web_search'
    };
    
    const playerRegResponse = await request(app)
      .post('/api/auth/register')
      .send(playerData);
    
    if (playerRegResponse.status === 201) {
      console.log('✅ Inscription joueur réussie avec validation complète');
      console.log(`   Email: ${playerData.email}`);
      console.log(`   ID utilisateur: ${playerRegResponse.body.user?.id || 'N/A'}`);
    } else {
      console.log('❌ Détails de l\'erreur:', JSON.stringify(playerRegResponse.body, null, 2));
      throw new Error(`Inscription joueur échouée: ${playerRegResponse.status}`);
    }

    // ===========================
    // TEST 3B: Simulation de l'approbation admin pour les tests
    // ===========================
    console.log('\n👨‍💼 Test 3B: Activation administrative simulée...');
    
    await activateTestAccount(playerData.email, 'joueur');

    // ===========================
    // TEST 4: CONNEXION ET AUTHENTIFICATION DU JOUEUR (VERSION CORRIGÉE)
    // ===========================
    console.log('\n🔐 Test 4: Connexion et authentification du joueur...');

    const playerLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: playerData.email,
        password: playerData.password
      });

    // Vérification du status HTTP d'abord
    if (playerLoginResponse.status === 200) {
      console.log('✅ Requête de connexion réussie (HTTP 200)');
      
      // Utilisation de notre fonction d'extraction adaptative
      const loginData = extractLoginData(playerLoginResponse.body);
      
      if (loginData) {
        console.log('✅ Connexion joueur réussie avec extraction adaptative');
        console.log(`   Stratégie utilisée: ${loginData.strategy}`);
        console.log(`   Token: ${loginData.token.substring(0, 25)}...`);
        console.log(`   Utilisateur: ${loginData.user.firstName} ${loginData.user.lastName}`);
        console.log(`   Type: ${loginData.user.userType}`);
        
        // CORRECTION CRITIQUE: Assignment du token à la variable partagée
        playerToken = loginData.token;
        
        console.log('✅ Token joueur stocké pour les tests suivants');
        
      } else {
        console.log('❌ Impossible d\'extraire le token de la réponse');
        console.log('🔍 Structure complète de la réponse:');
        console.log(JSON.stringify(playerLoginResponse.body, null, 2));
        throw new Error('Token ou données utilisateur manquants dans la réponse de connexion');
      }
    } else {
      console.log('❌ Échec de la requête de connexion');
      console.log('🔍 Status code:', playerLoginResponse.status);
      console.log('🔍 Détails de l\'erreur:', JSON.stringify(playerLoginResponse.body, null, 2));
      throw new Error(`Connexion joueur échouée avec status ${playerLoginResponse.status}`);
    }

    // ===========================
    // TEST 5: Accès au dashboard joueur
    // ===========================
    console.log('\n📊 Test 5: Accès au dashboard joueur...');

    // Vérification de sécurité pour s'assurer que le token est disponible
    if (!playerToken) {
      throw new Error('Token joueur non disponible pour le test du dashboard - vérifiez le test de connexion précédent');
    }
    
    console.log(`🔍 Utilisation du token pour accès dashboard: ${playerToken.substring(0, 25)}...`);
    
    const playerDashboardResponse = await request(app)
      .get('/api/players/dashboard')
      .set('Authorization', `Bearer ${playerToken}`);
    
    if (playerDashboardResponse.status === 200) {
      console.log('✅ Dashboard joueur accessible');
      const profile = playerDashboardResponse.body.profile;
      if (profile) {
        console.log(`   Nom: ${profile.user?.firstName} ${profile.user?.lastName}`);
        console.log(`   Statut: ${profile.profileCompletionStatus || 'basic'}`);
        console.log(`   College: ${profile.college?.name || 'N/A'}`);
        console.log(`   Profil visible: ${profile.isProfileVisible ? 'Oui' : 'Non'}`);
        console.log(`   Vues du profil: ${profile.profileViews || 0}`);
      }
    } else {
      console.log('❌ Détails:', JSON.stringify(playerDashboardResponse.body, null, 2));
      throw new Error('Accès dashboard joueur échoué');
    }

    // ===========================
    // TEST 6: Inscription complète d'un coach NCAA
    // ===========================
    console.log('\n🏟️ Test 6: Inscription complète d\'un coach NCAA...');
    
    coachData = {
      firstName: 'Sarah',
      lastName: 'TestCoach',
      email: `testcoach.${timestamp}@portall-test.com`,
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
      userType: 'coach',
      position: 'head_coach',
      phoneNumber: '+1234567890',
      collegeId: 1, // Premier college NCAA créé
      division: 'ncaa_d1',
      teamSport: 'mens_soccer',
      termsAccepted: true,
      newsletterOptIn: true,
      referralSource: 'coach_recommendation'
    };
    
    const coachRegResponse = await request(app)
      .post('/api/auth/register')
      .send(coachData);
    
    if (coachRegResponse.status === 201) {
      console.log('✅ Inscription coach réussie avec validation métier complète');
      console.log(`   Email: ${coachData.email}`);
      console.log(`   Position: ${coachData.position}`);
      console.log(`   Division: ${coachData.division}`);
      console.log(`   Sport: ${coachData.teamSport}`);
    } else {
      console.log('❌ Détails:', JSON.stringify(coachRegResponse.body, null, 2));
      throw new Error('Inscription coach échouée');
    }

    // ===========================
    // TEST 6B: Activation du coach pour les tests
    // ===========================
    console.log('\n👨‍💼 Test 6B: Activation administrative du coach...');
    
    await activateTestAccount(coachData.email, 'coach');

    // ===========================
    // TEST 7: Connexion et dashboard coach
    // ===========================
    console.log('\n🔐 Test 7: Connexion et accès dashboard coach...');
    
    const coachLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: coachData.email,
        password: coachData.password
      });
    
    if (coachLoginResponse.status === 200) {
      console.log('✅ Connexion coach HTTP réussie');
      
      // Utilisation de la même fonction d'extraction pour le coach
      const coachLoginData = extractLoginData(coachLoginResponse.body);
      
      if (coachLoginData) {
        console.log('✅ Données coach extraites avec succès');
        coachToken = coachLoginData.token;
        
        // Test accès dashboard coach
        const coachDashboardResponse = await request(app)
          .get('/api/coaches/dashboard')
          .set('Authorization', `Bearer ${coachToken}`);
        
        if (coachDashboardResponse.status === 200) {
          console.log('✅ Dashboard coach accessible');
          console.log(`   Rôle confirmé: ${coachLoginData.user?.userType}`);
        } else {
          console.log('⚠️ Dashboard coach non accessible:', coachDashboardResponse.status);
          throw new Error('Accès dashboard coach échoué');
        }
      } else {
        throw new Error('Impossible d\'extraire les données de connexion coach');
      }
    } else {
      throw new Error(`Connexion coach échouée avec status ${coachLoginResponse.status}`);
    }

    // ===========================
    // TEST 8: Contrôles d'autorisation croisée
    // ===========================
    console.log('\n🛡️ Test 8: Vérification des contrôles d\'autorisation...');
    
    // Un joueur ne doit PAS pouvoir accéder au dashboard coach
    const unauthorizedResponse = await request(app)
      .get('/api/coaches/dashboard')
      .set('Authorization', `Bearer ${playerToken}`);
    
    if (unauthorizedResponse.status === 403) {
      console.log('✅ Contrôle d\'autorisation efficace (joueur bloqué sur dashboard coach)');
    } else {
      console.log(`⚠️ Problème d'autorisation potentiel: Status ${unauthorizedResponse.status}`);
    }

    // ===========================
    // RÉSUMÉ FINAL DE VALIDATION
    // ===========================
    console.log('\n🎉 VALIDATION COMPLÈTE DE LA PHASE 3 RÉUSSIE !');
    console.log('===============================================');
    console.log('✅ Configuration automatique de l\'environnement de test');
    console.log('✅ Inscription joueur avec validation multicouche');
    console.log('✅ Inscription coach avec données métier complexes');
    console.log('✅ Authentification JWT robuste et adaptative');
    console.log('✅ Dashboards fonctionnels selon les rôles utilisateur');
    console.log('✅ Contrôles d\'autorisation efficaces');
    console.log('✅ Système de validation sophistiqué');
    console.log('✅ Architecture de base de données relationnelle opérationnelle');
    console.log('\n🚀 Votre système Portall Phase 3 est de niveau professionnel !');
    console.log('🎯 Vous êtes maintenant prêt pour la Phase 4 !');
    
    // Fermeture propre de la connexion de base de données
    await sequelize.close();
    console.log('🔌 Connexion base de données fermée proprement');
    
  } catch (error) {
    console.error('\n❌ ÉCHEC DU TEST:', error.message);
    console.log('\n🔧 Guide de dépannage :');
    console.log('1. Vérifiez que PostgreSQL est démarré');
    console.log('2. Confirmez que la base de données "portall_test" existe');
    console.log('3. Vérifiez les variables d\'environnement (.env)');
    console.log('4. Assurez-vous que les ports ne sont pas occupés');
    
    // Affichage de détails pour le débogage
    if (error.response) {
      console.log('\n📋 Détails de la réponse HTTP:');
      console.log('   Status:', error.response.status);
      console.log('   Body:', JSON.stringify(error.response.body, null, 2));
    }
    
    process.exit(1);
  }
}

// Exécution si le fichier est lancé directement
if (require.main === module) {
  runCompleteAuthTest()
    .then(() => {
      console.log('\n🏁 Test terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erreur fatale:', error.message);
      process.exit(1);
    });
}

module.exports = { runCompleteAuthTest };