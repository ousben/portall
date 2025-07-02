// portall/server/services/emailService.js

const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');

/**
 * Service d'email professionnel pour Portall avec support Gmail optimisé
 * 
 * Cette version du service gère intelligemment différents fournisseurs d'email
 * selon l'environnement. En développement, nous utilisons Gmail pour sa simplicité
 * et sa fiabilité. En production, nous basculons vers des services industriels.
 * 
 * Analogie : C'est comme avoir une boîte à outils avec différents outils
 * pour différentes situations - un marteau léger pour les petits travaux
 * (Gmail en dev) et un marteau pneumatique pour les gros chantiers (SendGrid en prod).
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.templatesCache = new Map();
    this.isInitialized = false;
    this.emailProvider = null; // Nouveau : tracker du provider utilisé
  }

  /**
   * Initialise le service email avec détection intelligente du provider
   * 
   * Cette méthode analyse l'environnement et configure automatiquement
   * le bon provider SMTP. Elle gère les spécificités de chaque service
   * pour optimiser la délivrabilité et les performances.
   */
  async initialize() {
    try {
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      if (isDevelopment) {
        // ========================
        // CONFIGURATION GMAIL POUR DÉVELOPPEMENT
        // ========================
        
        console.log('📧 Initializing Gmail service for development...');
        
        // Vérifier que les variables d'environnement Gmail sont configurées
        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
          throw new Error('Gmail credentials not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD');
        }
        
        this.transporter = nodemailer.createTransporter({
          service: 'gmail', // Utilise la configuration prédéfinie Gmail de Nodemailer
          auth: {
            user: process.env.GMAIL_USER, // Votre adresse Gmail complète
            pass: process.env.GMAIL_APP_PASSWORD // Le mot de passe d'application généré
          },
          // Options spécifiques à Gmail pour optimiser la délivrabilité
          pool: true, // Réutilise les connexions SMTP pour de meilleures performances
          maxConnections: 5, // Limite les connexions simultanées (Gmail a des limites)
          maxMessages: 100, // Nombre max d'emails par connexion
          rateDelta: 1000, // Délai minimum entre les emails (1 seconde)
          rateLimit: 5 // Max 5 emails par seconde
        });
        
        this.emailProvider = 'gmail';
        console.log(`✅ Gmail service initialized for ${process.env.GMAIL_USER}`);
        
      } else {
        // ========================
        // CONFIGURATION PRODUCTION (SendGrid, AWS SES, etc.)
        // ========================
        
        console.log('📧 Initializing production email service...');
        
        // Vous pouvez basculer entre différents providers selon vos variables d'env
        if (process.env.SENDGRID_API_KEY) {
          // Configuration SendGrid
          this.transporter = nodemailer.createTransporter({
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
          // Configuration AWS SES
          this.transporter = nodemailer.createTransporter({
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
          // Fallback vers configuration SMTP générique
          this.transporter = nodemailer.createTransporter({
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
      
      // Fournir des messages d'erreur spécifiques selon le contexte
      if (error.message.includes('Gmail credentials')) {
        console.error('💡 Gmail setup help: Please configure GMAIL_USER and GMAIL_APP_PASSWORD in your .env file');
      } else if (error.code === 'EAUTH') {
        console.error('💡 Authentication failed: Please verify your Gmail App Password is correct');
      }
      
      throw new Error(`Email service initialization failed: ${error.message}`);
    }
  }

  /**
   * Méthode d'envoi améliorée avec gestion spécifique des providers
   * 
   * Cette version adapte le comportement selon le provider utilisé.
   * Gmail a ses propres spécificités et limitations que nous gérons ici.
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
        // Headers spécifiques selon le provider
        headers: {
          'X-Portall-Template': template,
          'X-Portall-Priority': priority,
          'X-Portall-Provider': this.emailProvider
        }
      };

      // Adaptations spécifiques à Gmail
      if (this.emailProvider === 'gmail') {
        // Gmail gère automatiquement l'encodage et la délivrabilité
        // Nous ajoutons juste quelques headers pour le tracking
        mailOptions.headers['X-Portall-Environment'] = 'development';
      }

      // Envoyer l'email
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent successfully via ${this.emailProvider}: ${info.messageId}`);
      
      // Log spécifique selon le provider
      if (this.emailProvider === 'gmail') {
        console.log(`📧 Gmail delivery: Check your Gmail sent folder for confirmation`);
      }

      return {
        success: true,
        messageId: info.messageId,
        provider: this.emailProvider,
        // En développement avec Gmail, pas de preview URL mais confirmation dans Gmail
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
   * NOUVELLE MÉTHODE : Détermine l'adresse d'expéditeur selon le provider
   * 
   * Cette méthode gère intelligemment l'adresse "From" selon le contexte.
   * Gmail nécessite d'utiliser votre adresse Gmail comme expéditeur.
   */
  getFromAddress() {
    if (this.emailProvider === 'gmail') {
      // Avec Gmail, nous devons utiliser l'adresse Gmail comme expéditeur
      return {
        name: process.env.EMAIL_FROM_NAME || 'Portall Platform (Dev)',
        address: process.env.GMAIL_USER // Utilise l'adresse Gmail configurée
      };
    } else {
      // Avec d'autres providers, nous pouvons utiliser une adresse personnalisée
      return {
        name: process.env.EMAIL_FROM_NAME || 'Portall Platform',
        address: process.env.EMAIL_FROM_ADDRESS || 'noreply@portall.com'
      };
    }
  }

  /**
   * NOUVELLE MÉTHODE : Vérification de la santé du service email
   * 
   * Cette méthode permet de diagnostiquer les problèmes de configuration
   * et de s'assurer que le service email fonctionne correctement.
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
    }
    
    return suggestions;
  }

  // ... (les autres méthodes comme loadTemplate, sendWelcomeEmail, etc. restent identiques)
  
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

  // Toutes vos méthodes spécialisées restent identiques
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