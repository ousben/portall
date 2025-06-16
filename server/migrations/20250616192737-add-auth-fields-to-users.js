// portall/server/migrations/20250616192737-add-auth-fields-to-users.js

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'email_verification_token', {
      type: Sequelize.STRING,
      allowNull: true
    });
    
    await queryInterface.addColumn('users', 'password_reset_token', {
      type: Sequelize.STRING,
      allowNull: true
    });
    
    await queryInterface.addColumn('users', 'password_reset_expires', {
      type: Sequelize.DATE,
      allowNull: true
    });
    
    // Ajouter des index pour améliorer les performances
    await queryInterface.addIndex('users', ['email_verification_token']);
    await queryInterface.addIndex('users', ['password_reset_token']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('users', ['email_verification_token']);
    await queryInterface.removeIndex('users', ['password_reset_token']);
    await queryInterface.removeColumn('users', 'email_verification_token');
    await queryInterface.removeColumn('users', 'password_reset_token');
    await queryInterface.removeColumn('users', 'password_reset_expires');
  }
};