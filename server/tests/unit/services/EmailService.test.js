// portall/server/tests/unit/services/EmailService.test.js

process.env.NODE_ENV = 'test';

const emailService = require('../../../services/emailService');
const TestHelpers = require('../../utils/testHelpers');

/**
 * 📧 Tests unitaires du service EmailService - Communication utilisateur
 * 
 * Le service EmailService gère toute la communication par email de votre plateforme.
 * En environnement de test, il utilise un mode simulation qui évite l'envoi réel
 * d'emails tout en testant la logique métier complète.
 * 
 * 🎯 Concept pédagogique : "Mock vs Simulation Testing"
 * Au lieu de mocker chaque appel réseau, nous utilisons une simulation intelligente
 * qui reproduit le comportement du service réel sans effets de bord. C'est comme
 * un simulateur de vol : vous apprenez à piloter sans risquer un vrai avion.
 * 
 * 💡 Architecture de communication testée :
 * - Templates d'emails personnalisés par type d'utilisateur
 * - Gestion d'erreurs et retry logic
 * - Validation des données avant envoi
 * - Configuration multi-provider (Gmail, SMTP, AWS SES)
 * 
 * 🔧 Innovation technique : Tests avec simulation
 * Ces tests valident la logique métier sans dépendances externes,
 * permettant une exécution rapide et fiable en CI/CD.
 */

describe('📧 EmailService - Communication System Tests', () => {

  beforeAll(async () => {
    // Forcer l'environnement de test pour activer la simulation
    process.env.NODE_ENV = 'test';
    
    // Initialiser le service email en mode test
    await emailService.initialize();
  });

  describe('⚙️ Service Initialization', () => {
    test('Should initialize successfully in test environment', async () => {
      expect(emailService.isInitialized).toBe(true);
      expect(emailService.emailProvider).toBe(null); // Mode simulation
    });

    test('Should handle health check in test mode', async () => {
      const healthStatus = await emailService.healthCheck();
      
      expect(healthStatus.status).toBe('healthy');
      expect(healthStatus.mode).toBe('simulation');
      expect(healthStatus.message).toContain('test environment');
    });

    test('Should provide configuration information', async () => {
      const healthStatus = await emailService.healthCheck();
      
      expect(healthStatus).toHaveProperty('status');
      expect(healthStatus).toHaveProperty('mode');
      expect(healthStatus).toHaveProperty('message');
      expect(healthStatus).toHaveProperty('timestamp');
    });
  });

  describe('📨 Email Sending Simulation', () => {
    test('Should simulate email sending successfully', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email',
        template: 'welcome',
        data: {
          firstName: 'Test',
          lastName: 'User'
        }
      };

      const result = await emailService.sendEmail(emailData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.messageId).toMatch(/^test-\d+$/);
      expect(result.message).toContain('simulated successfully');
    });

    test('Should handle different email templates', async () => {
      const templates = [
        'welcome',
        'account-approved',
        'account-rejected',
        'password-reset'
      ];

      for (const template of templates) {
        const emailData = {
          to: 'template.test@example.com',
          template,
          data: {
            firstName: 'Template',
            lastName: 'Tester',
            resetLink: 'https://example.com/reset'
          }
        };

        const result = await emailService.sendEmail(emailData);
        
        expect(result.success).toBe(true);
        expect(result.template).toBe(template);
      }
    });

    test('Should validate email addresses', async () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test.example.com',
        '',
        null,
        undefined
      ];

      for (const invalidEmail of invalidEmails) {
        const emailData = {
          to: invalidEmail,
          template: 'welcome',
          data: { firstName: 'Test' }
        };

        await expect(emailService.sendEmail(emailData)).rejects.toThrow();
      }
    });

    test('Should require template for email sending', async () => {
      const emailData = {
        to: 'test@example.com',
        // template manquant
        data: { firstName: 'Test' }
      };

      await expect(emailService.sendEmail(emailData)).rejects.toThrow();
    });

    test('Should handle missing template data gracefully', async () => {
      const emailData = {
        to: 'missing.data@example.com',
        template: 'welcome'
        // data manquant
      };

      // Devrait fonctionner avec des données par défaut
      const result = await emailService.sendEmail(emailData);
      expect(result.success).toBe(true);
    });
  });

  describe('📋 Template System', () => {
    test('Should load and cache templates efficiently', async () => {
      const emailData = {
        to: 'cache.test@example.com',
        template: 'welcome',
        data: {
          firstName: 'Cache',
          lastName: 'Test'
        }
      };

      // Premier envoi - charge le template
      const startTime1 = Date.now();
      await emailService.sendEmail(emailData);
      const duration1 = Date.now() - startTime1;

      // Deuxième envoi - utilise le cache
      const startTime2 = Date.now();
      await emailService.sendEmail(emailData);
      const duration2 = Date.now() - startTime2;

      // Le deuxième envoi devrait être plus rapide (template mis en cache)
      expect(duration2).toBeLessThanOrEqual(duration1);
    });

    test('Should handle template compilation errors', async () => {
      const emailData = {
        to: 'error.test@example.com',
        template: 'non-existent-template',
        data: { firstName: 'Error' }
      };

      await expect(emailService.sendEmail(emailData)).rejects.toThrow();
    });

    test('Should support template variable substitution', async () => {
      const emailData = {
        to: 'variables.test@example.com',
        template: 'welcome',
        data: {
          firstName: 'Variable',
          lastName: 'Substitution',
          companyName: 'Portall',
          loginUrl: 'https://portall.app/login'
        }
      };

      const result = await emailService.sendEmail(emailData);
      
      expect(result.success).toBe(true);
      expect(result.compiledTemplate).toBeDefined();
    });
  });

  describe('👤 User-Specific Email Workflows', () => {
    let testPlayer;
    let testCoach;
    let testNJCAACoach;

    beforeEach(async () => {
      const playerData = await TestHelpers.createTestPlayer();
      const coachData = await TestHelpers.createTestCoach();
      const njcaaCoachData = await TestHelpers.createTestNJCAACoach();
      
      testPlayer = playerData.user;
      testCoach = coachData.user;
      testNJCAACoach = njcaaCoachData.user;
    });

    test('Should send welcome email to new player', async () => {
      const result = await emailService.sendWelcomeEmail(testPlayer);
      
      expect(result.success).toBe(true);
      expect(result.recipient).toBe(testPlayer.email);
      expect(result.template).toBe('welcome');
      expect(result.userType).toBe('player');
    });

    test('Should send welcome email to new coach', async () => {
      const result = await emailService.sendWelcomeEmail(testCoach);
      
      expect(result.success).toBe(true);
      expect(result.recipient).toBe(testCoach.email);
      expect(result.template).toBe('welcome');
      expect(result.userType).toBe('coach');
    });

    test('Should send welcome email to new NJCAA coach', async () => {
      const result = await emailService.sendWelcomeEmail(testNJCAACoach);
      
      expect(result.success).toBe(true);
      expect(result.recipient).toBe(testNJCAACoach.email);
      expect(result.template).toBe('welcome');
      expect(result.userType).toBe('njcaa_coach');
    });

    test('Should customize welcome content by user type', async () => {
      const playerResult = await emailService.sendWelcomeEmail(testPlayer);
      const coachResult = await emailService.sendWelcomeEmail(testCoach);
      
      expect(playerResult.customization).toContain('player');
      expect(coachResult.customization).toContain('coach');
      expect(playerResult.compiledTemplate).not.toBe(coachResult.compiledTemplate);
    });

    test('Should send account approval notification', async () => {
      const result = await emailService.sendAccountApprovedEmail(testPlayer);
      
      expect(result.success).toBe(true);
      expect(result.template).toBe('account-approved');
      expect(result.recipient).toBe(testPlayer.email);
    });

    test('Should send account rejection notification', async () => {
      const rejectionReason = 'Incomplete profile information';
      const result = await emailService.sendAccountRejectedEmail(testPlayer, rejectionReason);
      
      expect(result.success).toBe(true);
      expect(result.template).toBe('account-rejected');
      expect(result.rejectionReason).toBe(rejectionReason);
    });

    test('Should send password reset email with token', async () => {
      const resetToken = 'secure-reset-token-123';
      const result = await emailService.sendPasswordResetEmail(testCoach, resetToken);
      
      expect(result.success).toBe(true);
      expect(result.template).toBe('password-reset');
      expect(result.resetToken).toBe(resetToken);
      expect(result.resetLink).toContain(resetToken);
    });
  });

  describe('🔄 Email Queue and Retry Logic', () => {
    test('Should handle email queue processing', async () => {
      const emails = [
        {
          to: 'queue1@example.com',
          template: 'welcome',
          data: { firstName: 'Queue1' }
        },
        {
          to: 'queue2@example.com',
          template: 'welcome',
          data: { firstName: 'Queue2' }
        },
        {
          to: 'queue3@example.com',
          template: 'welcome',
          data: { firstName: 'Queue3' }
        }
      ];

      const results = await emailService.sendBulkEmails(emails);
      
      expect(results.length).toBe(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(results.every(r => r.messageId)).toBeTruthy();
    });

    test('Should simulate retry logic for failed emails', async () => {
      // Simuler un email qui échoue initialement
      const problematicEmail = {
        to: 'retry.test@example.com',
        template: 'welcome',
        data: { firstName: 'Retry' },
        simulateFailure: true // Flag pour simulation
      };

      const result = await emailService.sendEmailWithRetry(problematicEmail);
      
      expect(result.success).toBe(true);
      expect(result.attempts).toBeGreaterThan(1);
      expect(result.retried).toBe(true);
    });

    test('Should handle permanent failures gracefully', async () => {
      const permanentFailEmail = {
        to: 'permanent.fail@example.com',
        template: 'welcome',
        data: { firstName: 'Fail' },
        simulatePermanentFailure: true
      };

      await expect(emailService.sendEmailWithRetry(permanentFailEmail))
        .rejects.toThrow('Permanent email failure simulated');
    });
  });

  describe('📊 Email Analytics and Tracking', () => {
    test('Should track email sending statistics', async () => {
      // Envoyer plusieurs emails
      const emails = [
        { to: 'stats1@example.com', template: 'welcome', data: { firstName: 'Stats1' } },
        { to: 'stats2@example.com', template: 'account-approved', data: { firstName: 'Stats2' } },
        { to: 'stats3@example.com', template: 'password-reset', data: { firstName: 'Stats3' } }
      ];

      for (const email of emails) {
        await emailService.sendEmail(email);
      }

      const stats = await emailService.getEmailStats();
      
      expect(stats.totalSent).toBeGreaterThanOrEqual(3);
      expect(stats.templates).toHaveProperty('welcome');
      expect(stats.templates).toHaveProperty('account-approved');
      expect(stats.templates).toHaveProperty('password-reset');
    });

    test('Should track email performance metrics', async () => {
      const startTime = Date.now();
      
      await emailService.sendEmail({
        to: 'performance@example.com',
        template: 'welcome',
        data: { firstName: 'Performance' }
      });

      const endTime = Date.now();
      const stats = await emailService.getPerformanceStats();
      
      expect(stats.averageProcessingTime).toBeDefined();
      expect(stats.lastEmailTime).toBeDefined();
      expect(stats.successRate).toBeGreaterThan(0);
    });

    test('Should provide detailed analytics by template', async () => {
      // Envoyer différents types d'emails
      await emailService.sendEmail({
        to: 'analytics1@example.com',
        template: 'welcome',
        data: { firstName: 'Analytics1' }
      });

      await emailService.sendEmail({
        to: 'analytics2@example.com',
        template: 'welcome',
        data: { firstName: 'Analytics2' }
      });

      const templateStats = await emailService.getTemplateStats('welcome');
      
      expect(templateStats.count).toBeGreaterThanOrEqual(2);
      expect(templateStats.template).toBe('welcome');
      expect(templateStats.successRate).toBe(100); // En simulation, toujours 100%
    });
  });

  describe('🔒 Security and Validation', () => {
    test('Should sanitize email content to prevent injection', async () => {
      const maliciousData = {
        firstName: '<script>alert("xss")</script>',
        lastName: '"; DROP TABLE users; --',
        content: '<iframe src="malicious.com"></iframe>'
      };

      const result = await emailService.sendEmail({
        to: 'security@example.com',
        template: 'welcome',
        data: maliciousData
      });

      expect(result.success).toBe(true);
      expect(result.sanitized).toBe(true);
      expect(result.compiledTemplate).not.toContain('<script>');
      expect(result.compiledTemplate).not.toContain('DROP TABLE');
    });

    test('Should validate recipient email format strictly', async () => {
      const suspiciousEmails = [
        'admin@internal.company.com', // Email interne potentiel
        'test+malicious@evil.com',
        'very.long.email.address.that.might.be.suspicious@example.com'
      ];

      for (const email of suspiciousEmails) {
        const result = await emailService.sendEmail({
          to: email,
          template: 'welcome',
          data: { firstName: 'Security' }
        });

        expect(result.success).toBe(true);
        expect(result.validated).toBe(true);
      }
    });

    test('Should rate limit email sending', async () => {
      const emails = Array(20).fill().map((_, i) => ({
        to: `ratelimit${i}@example.com`,
        template: 'welcome',
        data: { firstName: `User${i}` }
      }));

      const startTime = Date.now();
      
      // Envoyer beaucoup d'emails rapidement
      const results = await Promise.all(
        emails.map(email => emailService.sendEmail(email))
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Le rate limiting devrait introduire un délai
      expect(duration).toBeGreaterThan(100); // Au moins 100ms pour 20 emails
      expect(results.every(r => r.success)).toBe(true);
    });

    test('Should handle email bounce simulation', async () => {
      const bounceEmail = {
        to: 'bounce@example.com',
        template: 'welcome',
        data: { firstName: 'Bounce' },
        simulateBounce: true
      };

      const result = await emailService.sendEmail(bounceEmail);
      
      expect(result.success).toBe(false);
      expect(result.bounced).toBe(true);
      expect(result.bounceReason).toBeDefined();
    });
  });

  describe('⚡ Performance and Reliability', () => {
    test('Should handle concurrent email sending', async () => {
      const concurrentEmails = Array(10).fill().map((_, i) => ({
        to: `concurrent${i}@example.com`,
        template: 'welcome',
        data: { firstName: `Concurrent${i}` }
      }));

      const promises = concurrentEmails.map(email => 
        emailService.sendEmail(email)
      );

      const results = await Promise.all(promises);
      
      expect(results.length).toBe(10);
      expect(results.every(r => r.success)).toBe(true);
      expect(results.every(r => r.messageId)).toBeTruthy();
    });

    test('Should process large email batches efficiently', async () => {
      const largeEmailBatch = Array(100).fill().map((_, i) => ({
        to: `batch${i}@example.com`,
        template: 'welcome',
        data: { firstName: `Batch${i}` }
      }));

      const startTime = Date.now();
      const results = await emailService.sendBulkEmails(largeEmailBatch);
      const endTime = Date.now();

      const duration = endTime - startTime;
      const avgTimePerEmail = duration / largeEmailBatch.length;

      expect(results.length).toBe(100);
      expect(results.every(r => r.success)).toBe(true);
      expect(avgTimePerEmail).toBeLessThan(50); // Moins de 50ms par email
    });

    test('Should maintain memory efficiency with template caching', async () => {
      // Utiliser le même template plusieurs fois
      const sameTemplateEmails = Array(50).fill().map((_, i) => ({
        to: `memory${i}@example.com`,
        template: 'welcome',
        data: { firstName: `Memory${i}` }
      }));

      const initialMemory = process.memoryUsage().heapUsed;

      for (const email of sameTemplateEmails) {
        await emailService.sendEmail(email);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // L'augmentation de mémoire devrait être raisonnable (moins de 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('🧹 Cleanup and Error Recovery', () => {
    test('Should clean up resources properly', async () => {
      const initialCacheSize = emailService.templatesCache.size;
      
      // Utiliser plusieurs templates
      await emailService.sendEmail({
        to: 'cleanup1@example.com',
        template: 'welcome',
        data: { firstName: 'Cleanup1' }
      });

      await emailService.sendEmail({
        to: 'cleanup2@example.com',
        template: 'account-approved',
        data: { firstName: 'Cleanup2' }
      });

      expect(emailService.templatesCache.size).toBeGreaterThan(initialCacheSize);

      // Nettoyer le cache
      await emailService.clearTemplateCache();
      
      expect(emailService.templatesCache.size).toBe(0);
    });

    test('Should recover from service interruption', async () => {
      // Simuler une interruption de service
      emailService.isInitialized = false;

      const emailData = {
        to: 'recovery@example.com',
        template: 'welcome',
        data: { firstName: 'Recovery' }
      };

      // Devrait se ré-initialiser automatiquement
      const result = await emailService.sendEmail(emailData);
      
      expect(result.success).toBe(true);
      expect(emailService.isInitialized).toBe(true);
    });
  });
});