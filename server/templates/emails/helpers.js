// portall/server/templates/emails/helpers.js

const handlebars = require('handlebars');

/**
 * Helpers Handlebars personnalisés pour nos templates emails
 * 
 * Ces helpers nous permettent d'avoir une logique conditionnelle
 * et de formatage dans nos templates.
 */

// Helper pour comparer des valeurs
handlebars.registerHelper('eq', function(a, b) {
  return a === b;
});

// Helper pour formater les dates
handlebars.registerHelper('formatDate', function(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Helper pour formater le type d'utilisateur
handlebars.registerHelper('formatUserType', function(userType) {
  const types = {
    'player': 'NJCAA Player',
    'coach': 'NCAA/NAIA Coach',
    'admin': 'Administrator'
  };
  return types[userType] || userType;
});

// Helper pour mettre en majuscule
handlebars.registerHelper('uppercase', function(str) {
  return str ? str.toUpperCase() : '';
});

module.exports = handlebars;