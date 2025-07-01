// portall/server/models/NJCAACollege.js

'use strict';

module.exports = (sequelize, DataTypes) => {
  const NJCAACollege = sequelize.define('NJCAACollege', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [2, 255]
      },
      set(value) {
        // Nettoyer et formater le nom du college
        this.setDataValue('name', value.trim());
      }
    },
    
    state: {
      type: DataTypes.STRING(2),
      allowNull: false,
      validate: {
        isLength: {
          args: [2, 2],
          msg: 'State code must be exactly 2 characters'
        },
        isAlpha: true
      },
      set(value) {
        // Toujours en majuscules pour la cohérence
        this.setDataValue('state', value.toUpperCase());
      }
    },
    
    region: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 10]
      }
    },
    
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    }
  }, {
    tableName: 'njcaa_colleges',
    timestamps: true,
    underscored: true,
    
    indexes: [
      {
        fields: ['state']
      },
      {
        fields: ['region'] 
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['name'],
        unique: true
      }
    ]
  });

  // Méthodes statiques utiles
  NJCAACollege.findActiveColleges = async function() {
    return await this.findAll({
      where: { isActive: true },
      order: [['state', 'ASC'], ['name', 'ASC']]
    });
  };

  NJCAACollege.findByState = async function(stateCode) {
    return await this.findAll({
      where: { 
        state: stateCode.toUpperCase(),
        isActive: true 
      },
      order: [['name', 'ASC']]
    });
  };

  // Les associations seront définies quand on créera PlayerProfile
  NJCAACollege.associate = function(models) {
    // Un college NJCAA peut avoir plusieurs joueurs
    NJCAACollege.hasMany(models.PlayerProfile, {
      foreignKey: 'collegeId',
      as: 'players'
    });
  };

  return NJCAACollege;
};