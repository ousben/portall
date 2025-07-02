// portall/server/services/emailService.js

const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');
require('../templates/emails/helpers');

/**
 * Service d'email professionnel pour Portall avec support Gmail optimisé
 * 
 * Cette version corrigée utilise la bonne syntaxe Nodemailer.
 * L'erreur précédente venait de l'utilisation de createTransporter 
 * au lieu de createTransport (sans le "er").
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.templatesCache = new Map();
    this.isInitialized = false;
    this.emailProvider = null;
  }

  /**
   * Initialise le service email avec détection intelligente du provider
   * 
   * CORRECTION MAJEURE : Utilisation de createTransport au lieu de createTransporter
   */
  async initialize() {
    try {
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      if (isDevelopment) {
        console.log('📧 Initializing Gmail service for development...');
        
        // Vérifier que les variables d'environnement Gmail sont configurées
        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
          throw new Error('Gmail credentials not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD');
        }
        
        // CORRECTION : createTransport au lieu de createTransporter
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
          },
          // Options spécifiques à Gmail pour optimiser la délivrabilité
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
          rateDelta: 1000,
          rateLimit: 5
        });
        
        this.emailProvider = 'gmail';
        console.log(`✅ Gmail service initialized for ${process.env.GMAIL_USER}`);
        
      } else {
        // Configuration production avec la même correction
        console.log('📧 Initializing production email service...');
        
        if (process.env.SENDGRID_API_KEY) {
          // CORRECTION : createTransport au lieu de createTransporter
          this.transporter = nodemailer.createTransport({
            host: 'smtp.sendgrid.net',
            port: 587,
            secure: false,
            auth: {
              user: 'apikey',
              pass: process.env.SENDGRID_API_KEY,
            }
          });
          this.emailProvider = 'sendgrid';
          
        } else if (process.env.AWS_SES_REGION) {
          // CORRECTION : createTransport au lieu de createTransporter
          this.transporter = nodemailer.createTransport({
            host: `email-smtp.${process.env.AWS_SES_REGION}.amazonaws.com`,
            port: 587,
            secure: false,
            auth: {
              user: process.env.AWS_ACCESS_KEY_ID,
              pass: process.env.AWS_SECRET_ACCESS_KEY,
            }
          });
          this.emailProvider = 'aws-ses';
          
        } else {
          // CORRECTION : createTransport au lieu de createTransporter
          this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          });
          this.emailProvider = 'custom-smtp';
        }
        
        console.log(`✅ Production email service initialized (${this.emailProvider})`);
      }

      // Vérifier la connexion au service SMTP
      await this.transporter.verify();
      this.isInitialized = true;
      
      console.log(`🎉 Email service ready with ${this.emailProvider} provider`);

    } catch (error) {
      console.error('❌ Email service initialization failed:', error);
      
      // Messages d'aide spécifiques selon le type d'erreur
      if (error.message.includes('Gmail credentials')) {
        console.error('💡 Gmail setup help: Please configure GMAIL_USER and GMAIL_APP_PASSWORD in your .env file');
      } else if (error.code === 'EAUTH') {
        console.error('💡 Authentication failed: Please verify your Gmail App Password is correct');
      } else if (error.code === 'ECONNECTION') {
        console.error('💡 Connection failed: Check your internet connection and firewall settings');
      }
      
      throw new Error(`Email service initialization failed: ${error.message}`);
    }
  }

  /**
   * Méthode d'envoi améliorée avec gestion spécifique des providers
   */
  async sendEmail({ to, subject, template, data, priority = 'normal' }) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log(`📤 Preparing to send email via ${this.emailProvider}: ${template} to ${to}`);

      // Charger et rendre le template
      const compiledTemplate = await this.loadTemplate(template);
      const htmlContent = compiledTemplate(data);

      // Configuration de l'email adaptée au provider
      const mailOptions = {
        from: this.getFromAddress(),
        to: to,
        subject: subject,
        html: htmlContent,
        priority: priority,
        headers: {
          'X-Portall-Template': template,
          'X-Portall-Priority': priority,
          'X-Portall-Provider': this.emailProvider
        }
      };

      // Adaptations spécifiques à Gmail
      if (this.emailProvider === 'gmail') {
        mailOptions.headers['X-Portall-Environment'] = 'development';
      }

      // Envoyer l'email
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent successfully via ${this.emailProvider}: ${info.messageId}`);
      
      if (this.emailProvider === 'gmail') {
        console.log(`📧 Gmail delivery: Check your Gmail sent folder for confirmation`);
      }

      return {
        success: true,
        messageId: info.messageId,
        provider: this.emailProvider,
        deliveryInfo: this.emailProvider === 'gmail' 
          ? 'Email delivered via Gmail - check your sent folder'
          : null
      };

    } catch (error) {
      console.error(`❌ Failed to send email via ${this.emailProvider} to ${to}:`, error);
      
      // Messages d'erreur spécifiques à Gmail
      if (this.emailProvider === 'gmail' && error.code === 'EAUTH') {
        console.error('💡 Gmail auth error: Your App Password may have expired. Generate a new one.');
      } else if (this.emailProvider === 'gmail' && error.responseCode === 554) {
        console.error('💡 Gmail rejected email: Check recipient address and content.');
      }
      
      return {
        success: false,
        error: error.message,
        provider: this.emailProvider
      };
    }
  }

  /**
   * Détermine l'adresse d'expéditeur selon le provider
   */
  getFromAddress() {
    if (this.emailProvider === 'gmail') {
      return {
        name: process.env.EMAIL_FROM_NAME || 'Portall Platform (Dev)',
        address: process.env.GMAIL_USER
      };
    } else {
      return {
        name: process.env.EMAIL_FROM_NAME || 'Portall Platform',
        address: process.env.EMAIL_FROM_ADDRESS || 'noreply@portall.com'
      };
    }
  }

  /**
   * Vérification de la santé du service email
   */
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      await this.transporter.verify();
      
      return {
        status: 'healthy',
        provider: this.emailProvider,
        isInitialized: this.isInitialized,
        fromAddress: this.getFromAddress(),
        message: `Email service is working correctly with ${this.emailProvider}`
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: this.emailProvider,
        error: error.message,
        suggestions: this.getHealthCheckSuggestions(error)
      };
    }
  }

  /**
   * Fournit des suggestions de dépannage selon l'erreur
   */
  getHealthCheckSuggestions(error) {
    const suggestions = [];
    
    if (error.code === 'EAUTH') {
      suggestions.push('Verify your Gmail App Password is correct');
      suggestions.push('Ensure 2FA is enabled on your Gmail account');
      suggestions.push('Generate a new App Password if needed');
    } else if (error.code === 'ECONNECTION') {
      suggestions.push('Check your internet connection');
      suggestions.push('Verify Gmail SMTP settings');
    } else if (error.message.includes('credentials')) {
      suggestions.push('Set GMAIL_USER and GMAIL_APP_PASSWORD in your .env file');
    } else if (error.message.includes('createTransporter')) {
      suggestions.push('This appears to be a code error - contact development team');
    }
    
    return suggestions;
  }

  /**
   * Charge et compile un template email
   */
  async loadTemplate(templateName) {
    try {
      if (this.templatesCache.has(templateName)) {
        return this.templatesCache.get(templateName);
      }

      const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.hbs`);
      const templateSource = await fs.readFile(templatePath, 'utf8');
      const compiledTemplate = handlebars.compile(templateSource);
      this.templatesCache.set(templateName, compiledTemplate);
      
      console.log(`📄 Template loaded and cached: ${templateName}`);
      return compiledTemplate;

    } catch (error) {
      console.error(`❌ Failed to load email template ${templateName}:`, error);
      throw new Error(`Email template loading failed: ${error.message}`);
    }
  }

  /**
   * Méthodes spécialisées pour chaque type d'email
   */
  async sendWelcomeEmail(user) {
    const subject = `Welcome to Portall, ${user.firstName}! ⚽`;
    
    return await this.sendEmail({
      to: user.email,
      subject,
      template: 'welcome',
      data: {
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@portall.com'
      }
    });
  }

  async sendAccountApprovedEmail(user, approvedBy) {
    const subject = `🎉 Your Portall account has been approved!`;
    
    return await this.sendEmail({
      to: user.email,
      subject,
      template: 'account-approved',
      data: {
        firstName: user.firstName,
        userType: user.userType,
        approvedBy: approvedBy,
        loginUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/login`,
        dashboardUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard`
      },
      priority: 'high'
    });
  }

  async sendAccountRejectedEmail(user, rejectionReason, rejectedBy) {
    const subject = `Update on your Portall application`;
    
    return await this.sendEmail({
      to: user.email,
      subject,
      template: 'account-rejected',
      data: {
        firstName: user.firstName,
        rejectionReason,
        rejectedBy,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@portall.com',
        reapplyUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/signup`
      }
    });
  }

  async sendPasswordResetEmail(user, resetToken) {
    const subject = `Reset your Portall password`;
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    return await this.sendEmail({
      to: user.email,
      subject,
      template: 'password-reset',
      data: {
        firstName: user.firstName,
        resetUrl,
        expiresIn: '1 hour',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@portall.com'
      },
      priority: 'high'
    });
  }

  async sendNewRegistrationNotificationToAdmin(user, adminEmails) {
    const subject = `New ${user.userType} registration pending approval`;
    
    const promises = adminEmails.map(adminEmail => 
      this.sendEmail({
        to: adminEmail,
        subject,
        template: 'admin-new-registration',
        data: {
          userName: user.getFullName(),
          userEmail: user.email,
          userType: user.userType,
          registrationDate: user.createdAt,
          reviewUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/admin/users/${user.id}`
        }
      })
    );

    return await Promise.all(promises);
  }
}

// Créer une instance singleton du service
const emailService = new EmailService();

module.exports = emailService;