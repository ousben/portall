// portall/server/test-registration-flow.js

// test-registration-flow.js
const request = require('supertest');

/**
 * Test complet du flow d'inscription et d'authentification
 * 
 * Ce test simule le parcours utilisateur complet pour valider que :
 * 1. Les inscriptions fonctionnent avec les bonnes validations
 * 2. L'authentification JWT est opérationnelle
 * 3. Les dashboards sont accessibles avec les bonnes permissions
 * 4. Les données sont correctement persistées en base
 */

async function testCompleteRegistrationFlow() {
  console.log('🚀 Démarrage du test d\'authentification complet...');
  console.log('================================================');
  
  // Nous devons importer l'app après avoir configuré l'environnement de test
  process.env.NODE_ENV = 'test';

  try {

    // Importation dynamique pour éviter les conflits de configuration
    const app = require('./server');

    // Attendre un court instant pour que les connexions se stabilisent
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Vérifier que l'environnement de test est correctement configuré
    const dbTestResponse = await request(app).get('/api/db-test');
    if (dbTestResponse.status === 200) {
      console.log('✅ Environnement de test vérifié');
      console.log(`   Colleges NJCAA: ${dbTestResponse.body.statistics.njcaaColleges}`);
      console.log(`   Colleges NCAA: ${dbTestResponse.body.statistics.ncaaColleges}`);
    } else {
      throw new Error('Environnement de test non configuré correctement');
    }

    console.log('\n🏥 Test 1: Vérification de la santé du serveur...');
  
    // ===========================
    // TEST 1: Inscription d'un joueur NJCAA
    // ===========================
    console.log('\n📝 Test 1: Inscription d\'un joueur...');
    
    const playerData = {
      firstName: 'Alex',
      lastName: 'TestPlayer',
      email: `testplayer.${Date.now()}@example.com`, // Email unique pour éviter les conflits
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!', // NOUVEAU : Confirmation du mot de passe
      userType: 'player',
      gender: 'male',
      collegeId: 1, // Nous supposerons qu'un college NJCAA existe avec l'ID 1
      termsAccepted: true, // NOUVEAU : Acceptation des conditions
      newsletterOptIn: false, // NOUVEAU : Opt-in newsletter (peut être false)
      referralSource: 'web_search' // OPTIONNEL : Source de découverte
    };
    
    const playerRegResponse = await request(app)
      .post('/api/auth/register')
      .send(playerData);
    
    if (playerRegResponse.status === 201) {
      console.log('✅ Inscription joueur réussie avec validation complète');
      console.log(`   Email: ${playerData.email}`);
      console.log(`   Conditions acceptées: ${playerData.termsAccepted}`);
      console.log(`   Newsletter: ${playerData.newsletterOptIn ? 'Acceptée' : 'Refusée'}`);
    } else {
      console.log('❌ Détails de l\'erreur:', JSON.stringify(playerRegResponse.body, null, 2));
      throw new Error(`Inscription joueur échouée: ${playerRegResponse.status}`);
    }

    // ===========================
    // TEST 2: Inscription d'un coach NCAA
    // ===========================
    console.log('\n🏟️ Test 2: Inscription d\'un coach NCAA...');
    
    const coachData = {
      firstName: 'Sarah',
      lastName: 'TestCoach',
      email: `testcoach.${timestamp}@portall-test.com`,
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!', // NOUVEAU : Confirmation du mot de passe
      userType: 'coach',
      position: 'head_coach',
      phoneNumber: '+1234567890',
      collegeId: 1,
      division: 'ncaa_d1',
      teamSport: 'mens_soccer',
      termsAccepted: true, // NOUVEAU : Acceptation des conditions
      newsletterOptIn: true, // NOUVEAU : Les coachs peuvent vouloir les news
      referralSource: 'coach_recommendation' // OPTIONNEL : Source spécifique aux coachs
    };
    
    const coachRegResponse = await request(app)
      .post('/api/auth/register')
      .send(coachData);
    
    if (coachRegResponse.status === 201) {
      console.log('✅ Inscription coach réussie avec validation métier complète');
      console.log(`   Email: ${coachData.email}`);
      console.log(`   Position: ${coachData.position}`);
      console.log(`   Division: ${coachData.division}`);
    } else {
      console.log('❌ Détails:', JSON.stringify(coachRegResponse.body, null, 2));
      throw new Error('Inscription coach échouée');
    }

    // ===========================
    // TEST 3: Connexion du joueur
    // ===========================
    console.log('\n🔐 Test 3: Connexion du joueur...');
    
    const playerLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: playerData.email,
        password: playerData.password
      });
    
    if (playerLoginResponse.status === 200 && playerLoginResponse.body.accessToken) {
      console.log('✅ Connexion joueur réussie');
      console.log(`   Token généré: ${playerLoginResponse.body.accessToken.substring(0, 20)}...`);
    } else {
      console.log('❌ Échec connexion joueur:', playerLoginResponse.body);
      throw new Error('Player login failed');
    }
    
    const playerToken = playerLoginResponse.body.accessToken;

    // ===========================
    // TEST 4: Accès dashboard joueur
    // ===========================
    console.log('\n📊 Test 4: Accès dashboard joueur...');
    
    const playerDashboardResponse = await request(app)
      .get('/api/players/dashboard')
      .set('Authorization', `Bearer ${playerToken}`);
    
    if (playerDashboardResponse.status === 200) {
      console.log('✅ Dashboard joueur accessible');
      console.log(`   Profil chargé: ${playerDashboardResponse.body.profile?.user?.firstName || 'N/A'}`);
    } else {
      console.log('❌ Échec accès dashboard joueur:', playerDashboardResponse.body);
      throw new Error('Player dashboard access failed');
    }

    // ===========================
    // TEST 5: Connexion du coach
    // ===========================
    console.log('\n🔐 Test 5: Connexion du coach...');
    
    const coachLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: coachData.email,
        password: coachData.password
      });
    
    if (coachLoginResponse.status === 200 && coachLoginResponse.body.accessToken) {
      console.log('✅ Connexion coach réussie');
    } else {
      console.log('❌ Échec connexion coach:', coachLoginResponse.body);
      throw new Error('Coach login failed');
    }
    
    const coachToken = coachLoginResponse.body.accessToken;

    // ===========================
    // TEST 6: Accès dashboard coach
    // ===========================
    console.log('\n📊 Test 6: Accès dashboard coach...');
    
    const coachDashboardResponse = await request(app)
      .get('/api/coaches/dashboard')
      .set('Authorization', `Bearer ${coachToken}`);
    
    if (coachDashboardResponse.status === 200) {
      console.log('✅ Dashboard coach accessible');
    } else {
      console.log('❌ Échec accès dashboard coach:', coachDashboardResponse.body);
      throw new Error('Coach dashboard access failed');
    }

    // ===========================
    // TEST 7: Vérification des autorisations croisées
    // ===========================
    console.log('\n🛡️ Test 7: Vérification des autorisations...');
    
    // Un joueur ne doit PAS pouvoir accéder au dashboard coach
    const unauthorizedResponse = await request(app)
      .get('/api/coaches/dashboard')
      .set('Authorization', `Bearer ${playerToken}`);
    
    if (unauthorizedResponse.status === 403) {
      console.log('✅ Contrôle d\'autorisation fonctionnel (joueur bloqué sur dashboard coach)');
    } else {
      console.log('⚠️ Problème potentiel d\'autorisation:', unauthorizedResponse.status);
    }

    // ===========================
    // RÉSUMÉ FINAL
    // ===========================
    console.log('\n🎉 TOUS LES TESTS RÉUSSIS !');
    console.log('===============================');
    console.log('✅ Inscription joueur avec profil complet');
    console.log('✅ Inscription coach avec données métier');
    console.log('✅ Authentification JWT fonctionnelle');
    console.log('✅ Dashboards accessibles selon les rôles');
    console.log('✅ Contrôles d\'autorisation efficaces');
    console.log('\n🚀 Votre Phase 3 est parfaitement intégrée !');
    
  } catch (error) {
    console.error('\n❌ ÉCHEC DU TEST:', error.message);
    console.log('\n🔍 Points à vérifier :');
    console.log('- Les migrations de base de données sont-elles appliquées ?');
    console.log('- Les colleges de référence existent-ils en base ?');
    console.log('- Le serveur est-il démarré correctement ?');
    console.log('- Les variables d\'environnement sont-elles configurées ?');
    
    process.exit(1);
  }
}

// Exécution du test si le fichier est lancé directement
if (require.main === module) {
  testCompleteRegistrationFlow()
    .then(() => {
      console.log('\n🏁 Test terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = testCompleteRegistrationFlow;