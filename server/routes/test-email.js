// portall/server/routes/test-email.js

const express = require('express');
const emailService = require('../services/emailService');

const router = express.Router();

/**
 * Routes de test pour le système d'emails en développement
 * 
 * Ces routes permettent de tester et diagnostiquer votre configuration email
 * sans avoir à passer par le workflow complet d'inscription. Pensez à cela
 * comme des "outils de diagnostic" pour votre système email.
 */

// Route de diagnostic de santé du service email
router.get('/health', async (req, res) => {
  try {
    console.log('🔍 Email service health check requested');
    
    // Vérifier l'état du service email
    const healthStatus = await emailService.healthCheck();
    
    console.log(`📊 Health check result: ${healthStatus.status}`);
    
    return res.status(healthStatus.status === 'healthy' ? 200 : 500).json({
      status: healthStatus.status === 'healthy' ? 'success' : 'error',
      message: healthStatus.message || 'Email service health check completed',
      data: healthStatus
    });
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      suggestions: [
        'Check your Gmail credentials in .env file',
        'Ensure GMAIL_USER and GMAIL_APP_PASSWORD are correctly set',
        'Verify your Gmail App Password is valid'
      ]
    });
  }
});

// Route de test d'envoi d'email
router.post('/send-test', async (req, res) => {
  try {
    console.log('📧 Test email send requested');
    
    const { to, template = 'welcome' } = req.body;
    
    // Validation des paramètres d'entrée
    if (!to) {
      return res.status(400).json({
        status: 'error',
        message: 'Recipient email (to) is required',
        example: {
          to: 'test@example.com',
          template: 'welcome'
        }
      });
    }

    // Validation du format email basique
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid email format provided'
      });
    }

    console.log(`📤 Attempting to send ${template} email to ${to}`);

    // Envoyer l'email de test selon le template choisi
    let result;
    
    switch (template) {
      case 'welcome':
        result = await emailService.sendWelcomeEmail({ 
          email: to, 
          firstName: 'Test', 
          lastName: 'User', 
          userType: 'player' 
        });
        break;
        
      case 'account-approved':
        result = await emailService.sendAccountApprovedEmail(
          { email: to, firstName: 'Test', userType: 'player' },
          'Test Admin'
        );
        break;
        
      case 'account-rejected':
        result = await emailService.sendAccountRejectedEmail(
          { email: to, firstName: 'Test' },
          'This is a test rejection for development purposes',
          'Test Admin'
        );
        break;
        
      case 'password-reset':
        result = await emailService.sendPasswordResetEmail(
          { email: to, firstName: 'Test' },
          'test-reset-token-123'
        );
        break;
        
      default:
        return res.status(400).json({
          status: 'error',
          message: 'Invalid template specified',
          availableTemplates: ['welcome', 'account-approved', 'account-rejected', 'password-reset']
        });
    }

    if (result.success) {
      console.log(`✅ Test email sent successfully via ${result.provider}`);
      
      return res.status(200).json({
        status: 'success',
        message: `Test email sent successfully via ${result.provider}`,
        data: {
          template: template,
          recipient: to,
          provider: result.provider,
          messageId: result.messageId,
          deliveryInfo: result.deliveryInfo || 'Check your Gmail sent folder for confirmation'
        }
      });
    } else {
      console.error(`❌ Failed to send test email: ${result.error}`);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to send test email',
        error: result.error,
        provider: result.provider
      });
    }

  } catch (error) {
    console.error('❌ Test email route error:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Test email sending failed',
      error: error.message,
      troubleshooting: {
        checkGmailCredentials: 'Verify GMAIL_USER and GMAIL_APP_PASSWORD in .env',
        checkEmailService: 'Try the /health endpoint first',
        checkTemplate: 'Ensure the email template exists'
      }
    });
  }
});

// Route d'information sur les templates disponibles
router.get('/templates', (req, res) => {
  res.json({
    status: 'success',
    message: 'Available email templates',
    data: {
      templates: [
        {
          name: 'welcome',
          description: 'Welcome email sent after user registration',
          usage: 'POST /api/test/email/send-test with {"to": "email", "template": "welcome"}'
        },
        {
          name: 'account-approved',
          description: 'Notification email when admin approves an account',
          usage: 'POST /api/test/email/send-test with {"to": "email", "template": "account-approved"}'
        },
        {
          name: 'account-rejected',
          description: 'Notification email when admin rejects an account',
          usage: 'POST /api/test/email/send-test with {"to": "email", "template": "account-rejected"}'
        },
        {
          name: 'password-reset',
          description: 'Password reset email with secure token',
          usage: 'POST /api/test/email/send-test with {"to": "email", "template": "password-reset"}'
        }
      ]
    }
  });
});

module.exports = router;