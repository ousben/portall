// portall/server/routes/test-email.js - NOUVELLE ROUTE DE TEST

const express = require('express');
const emailService = require('../services/emailService');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * Route de test pour le système d'emails
 * 
 * Cette route est uniquement disponible en développement et permet
 * de tester rapidement la configuration email sans passer par
 * le workflow complet d'inscription/approbation.
 */

// Health check du service email
router.get('/health', async (req, res) => {
  try {
    const healthStatus = await emailService.healthCheck();
    
    return res.status(healthStatus.status === 'healthy' ? 200 : 500).json({
      status: healthStatus.status === 'healthy' ? 'success' : 'error',
      message: healthStatus.message || 'Email service health check completed',
      data: healthStatus
    });
    
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

// Test d'envoi d'email simple (uniquement en développement)
router.post('/send-test', async (req, res) => {
  // Sécurité : uniquement en développement
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      status: 'error',
      message: 'Test email route not available in production'
    });
  }

  try {
    const { to, template = 'welcome' } = req.body;
    
    if (!to) {
      return res.status(400).json({
        status: 'error',
        message: 'Recipient email (to) is required'
      });
    }

    // Données de test pour les templates
    const testData = {
      firstName: 'Test',
      lastName: 'User',
      userType: 'player',
      supportEmail: process.env.SUPPORT_EMAIL || process.env.GMAIL_USER,
      approvedBy: 'Test Admin',
      loginUrl: `${process.env.CLIENT_URL}/login`,
      dashboardUrl: `${process.env.CLIENT_URL}/dashboard`,
      rejectionReason: 'This is a test rejection for development purposes',
      rejectedBy: 'Test Admin',
      reapplyUrl: `${process.env.CLIENT_URL}/signup`,
      resetUrl: `${process.env.CLIENT_URL}/reset-password?token=test123`,
      expiresIn: '1 hour',
      userName: 'Test User',
      userEmail: to,
      registrationDate: new Date(),
      reviewUrl: `${process.env.CLIENT_URL}/admin/users/123`
    };

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
          'This is a test rejection',
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
          message: 'Invalid template. Available: welcome, account-approved, account-rejected, password-reset'
        });
    }

    return res.status(200).json({
      status: 'success',
      message: `Test email sent successfully via ${result.provider}`,
      data: {
        template: template,
        recipient: to,
        provider: result.provider,
        messageId: result.messageId,
        deliveryInfo: result.deliveryInfo
      }
    });

  } catch (error) {
    console.error('Test email error:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to send test email',
      error: error.message
    });
  }
});

module.exports = router;