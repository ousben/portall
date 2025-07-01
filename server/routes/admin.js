// portall/server/routes/admin.js

const express = require('express');
const AdminController = require('../controllers/adminController');
const { requireAdminAccess, logAdminAction, rateLimitAdminActions } = require('../middleware/adminSecurity');
const { validate } = require('../validators/authValidators');
const Joi = require('joi');

const router = express.Router();

/**
 * Routes administratives pour la gestion des utilisateurs
 * 
 * Toutes ces routes sont protégées par des middlewares de sécurité
 * multicouches et incluent un logging complet pour audit.
 * 
 * Architecture de sécurité :
 * 1. requireAdminAccess : Vérification d'authentification admin
 * 2. rateLimitAdminActions : Protection contre les actions en masse
 * 3. logAdminAction : Enregistrement pour audit
 * 4. validate : Validation des données d'entrée
 */

// ========================
// ROUTES DE CONSULTATION (LECTURE SEULE)
// ========================

// GET /api/admin/dashboard
// Tableau de bord principal avec statistiques globales
router.get('/dashboard',
  requireAdminAccess,
  logAdminAction('VIEW_DASHBOARD'),
  AdminController.getDashboard
);

// GET /api/admin/users/pending
// Liste des utilisateurs en attente de validation
router.get('/users/pending',
  requireAdminAccess,
  logAdminAction('VIEW_PENDING_USERS'),
  // Validation des paramètres de requête
  (req, res, next) => {
    const querySchema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      userType: Joi.string().valid('all', 'player', 'coach').default('all'),
      sortBy: Joi.string().valid('createdAt', 'firstName', 'lastName', 'email').default('createdAt'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
      search: Joi.string().max(100).default('')
    });

    const { error, value } = querySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid query parameters',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    req.query = value;
    next();
  },
  AdminController.getPendingUsers
);

// GET /api/admin/users/:userId
// Détails complets d'un utilisateur spécifique
router.get('/users/:userId',
  requireAdminAccess,
  logAdminAction('VIEW_USER_DETAILS'),
  // Validation du paramètre userId
  (req, res, next) => {
    const userIdSchema = Joi.object({
      userId: Joi.number().integer().positive().required()
    });

    const { error, value } = userIdSchema.validate(req.params);
    if (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID',
        code: 'INVALID_USER_ID'
      });
    }

    req.params = value;
    next();
  },
  AdminController.getUserDetails
);

// ========================
// ROUTES D'ACTION (MODIFICATION DE DONNÉES)
// ========================

// POST /api/admin/users/:userId/approve
// Approuver un compte utilisateur
router.post('/users/:userId/approve',
  requireAdminAccess,
  rateLimitAdminActions(20, 60000), // Max 20 approbations par minute
  logAdminAction('APPROVE_USER'),
  // Validation des paramètres
  (req, res, next) => {
    const approvalSchema = Joi.object({
      userId: Joi.number().integer().positive().required()
    });

    const bodySchema = Joi.object({
      approvalNote: Joi.string().max(500).optional().default('')
    });

    const paramValidation = approvalSchema.validate(req.params);
    const bodyValidation = bodySchema.validate(req.body);

    if (paramValidation.error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID',
        code: 'INVALID_USER_ID'
      });
    }

    if (bodyValidation.error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request body',
        errors: bodyValidation.error.details
      });
    }

    req.params = paramValidation.value;
    req.body = bodyValidation.value;
    next();
  },
  AdminController.approveUser
);

// POST /api/admin/users/:userId/reject
// Rejeter un compte utilisateur
router.post('/users/:userId/reject',
  requireAdminAccess,
  rateLimitAdminActions(10, 60000), // Max 10 rejets par minute (plus restrictif)
  logAdminAction('REJECT_USER'),
  // Validation stricte pour les rejets
  (req, res, next) => {
    const paramSchema = Joi.object({
      userId: Joi.number().integer().positive().required()
    });

    const bodySchema = Joi.object({
      rejectionReason: Joi.string()
        .min(10)
        .max(1000)
        .required()
        .messages({
          'string.min': 'Rejection reason must be at least 10 characters long',
          'string.max': 'Rejection reason must not exceed 1000 characters',
          'any.required': 'Rejection reason is required for audit purposes'
        }),
      deleteAccount: Joi.boolean().default(false)
    });

    const paramValidation = paramSchema.validate(req.params);
    const bodyValidation = bodySchema.validate(req.body);

    if (paramValidation.error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID',
        code: 'INVALID_USER_ID'
      });
    }

    if (bodyValidation.error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid rejection data',
        errors: bodyValidation.error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    req.params = paramValidation.value;
    req.body = bodyValidation.value;
    next();
  },
  AdminController.rejectUser
);

// ========================
// ROUTES D'AUDIT ET LOGGING
// ========================

// GET /api/admin/audit/actions
// Historique des actions administratives (à implémenter)
router.get('/audit/actions',
  requireAdminAccess,
  logAdminAction('VIEW_AUDIT_LOG'),
  (req, res) => {
    // TODO: Implémenter la consultation des logs d'audit
    res.status(501).json({
      status: 'info',
      message: 'Audit log viewing will be implemented in the next iteration',
      code: 'FEATURE_COMING_SOON'
    });
  }
);

// ========================
// ROUTE DE SANTÉ ADMINISTRATIVE
// ========================

router.get('/health',
  requireAdminAccess,
  (req, res) => {
    res.json({
      status: 'success',
      message: 'Admin service is running',
      timestamp: new Date().toISOString(),
      adminUser: req.admin.getFullName(),
      availableActions: [
        'View dashboard',
        'Manage pending users',
        'Approve/reject accounts',
        'View user details',
        'Access audit logs'
      ],
      endpoints: {
        dashboard: 'GET /api/admin/dashboard',
        pendingUsers: 'GET /api/admin/users/pending',
        userDetails: 'GET /api/admin/users/:userId',
        approveUser: 'POST /api/admin/users/:userId/approve',
        rejectUser: 'POST /api/admin/users/:userId/reject',
        auditLog: 'GET /api/admin/audit/actions'
      }
    });
  }
);

module.exports = router;