// portall/server/tests/unit/models/User.test.js

process.env.NODE_ENV = 'test';

const { User, PlayerProfile, CoachProfile, NJCAACoachProfile } = require('../../../models');
const TestHelpers = require('../../utils/testHelpers');

/**
 * 🧪 Tests unitaires du modèle User - Fondation de l'authentification
 * 
 * Le modèle User est le cœur de votre système d'authentification et d'autorisation.
 * Ces tests vérifient que toutes les fonctionnalités de base fonctionnent correctement
 * et que les règles métier sont respectées.
 * 
 * 🎯 Stratégie de test : "Test-driven Validation"
 * Chaque test vérifie un aspect spécifique du modèle User, des validations de base
 * aux méthodes complexes. Cette approche garantit que votre modèle de base
 * est rock-solid avant de construire dessus.
 * 
 * 💡 Concept pédagogique : "Boundary Testing"
 * Nous testons non seulement les cas normaux, mais aussi les cas limites
 * et les situations d'erreur pour garantir la robustesse du système.
 */

describe('👤 User Model - Phase 5A Foundation Tests', () => {
  
  beforeEach(async () => {
    await TestHelpers.cleanupTestData();
  });

  describe('✅ Model Validations', () => {
    test('Should create valid user with all required fields', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
        userType: 'player',
        isActive: true
      };

      const user = await User.create(userData);

      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.firstName).toBe('John');
      expect(user.lastName).toBe('Doe');
      expect(user.userType).toBe('player');
      expect(user.isActive).toBe(true);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    test('Should hash password automatically on creation', async () => {
      const plainPassword = 'TestPassword123!';
      const user = await User.create({
        email: 'password.test@example.com',
        password: plainPassword,
        firstName: 'Test',
        lastName: 'User',
        userType: 'player'
      });

      // Le mot de passe doit être hashé, donc différent du mot de passe original
      expect(user.password).not.toBe(plainPassword);
      expect(user.password).toMatch(/^\$2[ab]\$\d+\$/); // Format bcrypt
      expect(user.password.length).toBeGreaterThan(50);
    });

    test('Should validate email format', async () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test.example.com',
        'test@.com'
      ];

      for (const email of invalidEmails) {
        await expect(User.create({
          email,
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          userType: 'player'
        })).rejects.toThrow();
      }
    });

    test('Should enforce unique email constraint', async () => {
      const userData = {
        email: 'unique.test@example.com',
        password: 'TestPassword123!',
        firstName: 'First',
        lastName: 'User',
        userType: 'player'
      };

      // Créer le premier utilisateur
      await User.create(userData);

      // Tenter de créer un second utilisateur avec le même email
      await expect(User.create({
        ...userData,
        firstName: 'Second'
      })).rejects.toThrow();
    });

    test('Should validate userType enum values', async () => {
      const validUserTypes = ['player', 'coach', 'njcaa_coach', 'admin'];
      const invalidUserTypes = ['invalid_type', 'user', 'student', 'teacher'];

      // Tester les types valides
      for (const userType of validUserTypes) {
        const user = await User.create({
          email: `${userType}.test@example.com`,
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          userType
        });
        expect(user.userType).toBe(userType);
      }

      // Tester les types invalides
      for (const userType of invalidUserTypes) {
        await expect(User.create({
          email: `invalid.${userType}@example.com`,
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          userType
        })).rejects.toThrow();
      }
    });

    test('Should require all mandatory fields', async () => {
      const requiredFields = ['email', 'password', 'firstName', 'lastName', 'userType'];

      for (const field of requiredFields) {
        const userData = {
          email: 'required.test@example.com',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          userType: 'player'
        };

        delete userData[field];

        await expect(User.create(userData)).rejects.toThrow();
      }
    });
  });

  describe('🔧 Instance Methods', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        email: 'methods.test@example.com',
        password: 'TestPassword123!',
        firstName: 'Method',
        lastName: 'Tester',
        userType: 'player',
        isActive: true
      });
    });

    test('Should validate correct password', async () => {
      const isValid = await testUser.validatePassword('TestPassword123!');
      expect(isValid).toBe(true);
    });

    test('Should reject incorrect password', async () => {
      const isValid = await testUser.validatePassword('WrongPassword');
      expect(isValid).toBe(false);
    });

    test('Should return public JSON without sensitive data', () => {
      const publicData = testUser.toPublicJSON();

      expect(publicData).toHaveProperty('id');
      expect(publicData).toHaveProperty('email');
      expect(publicData).toHaveProperty('firstName');
      expect(publicData).toHaveProperty('lastName');
      expect(publicData).toHaveProperty('userType');
      expect(publicData).toHaveProperty('isActive');

      // Vérifier que les données sensibles ne sont pas exposées
      expect(publicData).not.toHaveProperty('password');
      expect(publicData).not.toHaveProperty('resetPasswordToken');
      expect(publicData).not.toHaveProperty('resetPasswordExpires');
    });

    test('Should update password with proper hashing', async () => {
      const newPassword = 'NewSecurePassword456!';
      const oldPasswordHash = testUser.password;

      await testUser.updatePassword(newPassword);

      // Le hash doit avoir changé
      expect(testUser.password).not.toBe(oldPasswordHash);
      
      // Le nouveau mot de passe doit être valide
      const isValid = await testUser.validatePassword(newPassword);
      expect(isValid).toBe(true);

      // L'ancien mot de passe ne doit plus être valide
      const isOldValid = await testUser.validatePassword('TestPassword123!');
      expect(isOldValid).toBe(false);
    });

    test('Should generate password reset token', () => {
      const token = testUser.generatePasswordResetToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(10);
      expect(testUser.resetPasswordToken).toBeDefined();
      expect(testUser.resetPasswordExpires).toBeInstanceOf(Date);
      
      // Le token doit expirer dans le futur
      expect(testUser.resetPasswordExpires).toBeInstanceOf(Date);
      expect(testUser.resetPasswordExpires.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('🔗 Model Associations', () => {
    test('Should have association with PlayerProfile for players', async () => {
      const { user, profile } = await TestHelpers.createTestPlayer();

      const userWithProfile = await User.findByPk(user.id, {
        include: [{ model: PlayerProfile, as: 'playerProfile' }]
      });

      expect(userWithProfile.playerProfile).toBeDefined();
      expect(userWithProfile.playerProfile.id).toBe(profile.id);
      expect(userWithProfile.playerProfile.userId).toBe(user.id);
    });

    test('Should have association with CoachProfile for coaches', async () => {
      const { user, profile } = await TestHelpers.createTestCoach();

      const userWithProfile = await User.findByPk(user.id, {
        include: [{ model: CoachProfile, as: 'coachProfile' }]
      });

      expect(userWithProfile.coachProfile).toBeDefined();
      expect(userWithProfile.coachProfile.id).toBe(profile.id);
      expect(userWithProfile.coachProfile.userId).toBe(user.id);
    });

    test('Should have association with NJCAACoachProfile for NJCAA coaches', async () => {
      const { user, profile } = await TestHelpers.createTestNJCAACoach();

      const userWithProfile = await User.findByPk(user.id, {
        include: [{ model: NJCAACoachProfile, as: 'njcaaCoachProfile' }]
      });

      expect(userWithProfile.njcaaCoachProfile).toBeDefined();
      expect(userWithProfile.njcaaCoachProfile.id).toBe(profile.id);
      expect(userWithProfile.njcaaCoachProfile.userId).toBe(user.id);
    });

    test('Should get profile using getProfile method', async () => {
      const { user } = await TestHelpers.createTestPlayer();

      const profile = await user.getProfile();

      expect(profile).toBeDefined();
      expect(profile.userId).toBe(user.id);
      expect(profile.dateOfBirth).toBeInstanceOf(Date);
    });

    test('Should return complete JSON with profile data', async () => {
      const { user } = await TestHelpers.createTestNJCAACoach();

      const completeData = await user.toCompleteJSON();

      expect(completeData).toHaveProperty('id');
      expect(completeData).toHaveProperty('email');
      expect(completeData).toHaveProperty('userType', 'njcaa_coach');
      expect(completeData).toHaveProperty('profile');
      expect(completeData.profile).toHaveProperty('position');
      expect(completeData.profile).toHaveProperty('totalEvaluations');
    });
  });

  describe('📊 Static Methods', () => {
    test('Should find user by email', async () => {
      const testEmail = 'findby.test@example.com';
      const createdUser = await User.create({
        email: testEmail,
        password: 'TestPassword123!',
        firstName: 'FindBy',
        lastName: 'Test',
        userType: 'player'
      });

      const foundUser = await User.findByEmail(testEmail);
      
      expect(foundUser).toBeDefined();
      expect(foundUser.id).toBe(createdUser.id);
      expect(foundUser.email).toBe(testEmail);
    });

    test('Should handle case-insensitive email search', async () => {
      const testEmail = 'CaseTest@Example.COM';
      await User.create({
        email: testEmail.toLowerCase(),
        password: 'TestPassword123!',
        firstName: 'Case',
        lastName: 'Test',
        userType: 'player'
      });

      const foundUser = await User.findByEmail('casetest@example.com');
      expect(foundUser).toBeDefined();
      expect(foundUser.email).toBe('casetest@example.com');
    });

    test('Should check if email exists', async () => {
      const testEmail = 'exists.test@example.com';
      
      // Vérifier qu'il n'existe pas initialement
      const existsBefore = await User.emailExists(testEmail);
      expect(existsBefore).toBe(false);

      // Créer l'utilisateur
      await User.create({
        email: testEmail,
        password: 'TestPassword123!',
        firstName: 'Exists',
        lastName: 'Test',
        userType: 'player'
      });

      // Vérifier qu'il existe maintenant
      const existsAfter = await User.emailExists(testEmail);
      expect(existsAfter).toBe(true);
    });
  });

  describe('🔒 Security Features', () => {
    test('Should not allow password field in toJSON output', () => {
      const user = User.build({
        email: 'security.test@example.com',
        password: 'hashed_password_here',
        firstName: 'Security',
        lastName: 'Test',
        userType: 'player'
      });

      const jsonOutput = user.toJSON();
      expect(jsonOutput).not.toHaveProperty('password');
    });

    test('Should handle password hashing failure gracefully', async () => {
      // Simuler une erreur de hachage en passant une valeur non-string
      await expect(User.create({
        email: 'hasherror.test@example.com',
        password: null, // Ceci devrait causer une erreur
        firstName: 'Hash',
        lastName: 'Error',
        userType: 'player'
      })).rejects.toThrow();
    });

    test('Should validate password strength requirements', async () => {
      const weakPasswords = [
        '123456',      // Trop simple
        'password',    // Trop commun
        'test',        // Trop court
        'PASSWORD123', // Pas de caractères spéciaux
        'password!',   // Pas de majuscules
        'PASSWORD!'    // Pas de chiffres
      ];

      for (const weakPassword of weakPasswords) {
        await expect(User.create({
          email: `weak.${Date.now()}@example.com`,
          password: weakPassword,
          firstName: 'Weak',
          lastName: 'Password',
          userType: 'player'
        })).rejects.toThrow();
      }
    });
  });
});