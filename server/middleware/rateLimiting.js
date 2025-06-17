// portall/server/middleware/rateLimiting.js

const rateLimit = require('express-rate-limit');
const { rateLimit: rateLimitConfig } = require('../config/auth');

/**
 * Rate limiting pour les routes d'authentification sensibles
 * 
 * Imaginez cela comme un système de sécurité qui compte combien de fois
 * quelqu'un essaie d'entrer et bloque temporairement les tentatives suspectes
 */

// Rate limiter strict pour login et register
const authLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs, // 15 minutes
  max: rateLimitConfig.maxAttempts, // 5 tentatives max
  message: {
    status: 'error',
    message: 'Too many attempts. Please try again later.',
    retryAfter: Math.ceil(rateLimitConfig.windowMs / 1000 / 60) // en minutes
  },
  standardHeaders: true, // Retourne les headers rate limit
  legacyHeaders: false,
  // Clé personnalisée : on combine IP + email si disponible
  keyGenerator: (req) => {
    const email = req.body?.email || '';
    return `${req.ip}-${email}`;
  },
  // Handler personnalisé pour logger les tentatives bloquées
  handler: (req, res) => {
    console.log(`🚫 Rate limit exceeded for IP: ${req.ip}, Email: ${req.body?.email || 'unknown'}`);
    res.status(429).json({
      status: 'error',
      message: 'Too many attempts. Please try again later.',
      retryAfter: Math.ceil(rateLimitConfig.windowMs / 1000 / 60),
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }
});

// Rate limiter plus permissif pour les autres routes auth
const generalAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 tentatives max
  message: {
    status: 'error',
    message: 'Too many requests. Please try again later.'
  }
});

// Rate limiter spécial pour forgot password (plus restrictif car coûteux)
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 3, // 3 tentatives par heure max
  message: {
    status: 'error',
    message: 'Too many password reset requests. Please try again later.',
    retryAfter: 60 // en minutes
  },
  keyGenerator: (req) => {
    const email = req.body?.email || '';
    return `forgot-${req.ip}-${email}`;
  }
});

module.exports = {
  authLimiter,
  generalAuthLimiter,
  forgotPasswordLimiter
};