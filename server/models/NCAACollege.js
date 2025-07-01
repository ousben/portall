// portall/server/models/NCAACollege.js

'use strict';

module.exports = (sequelize, DataTypes) => {
  const NCAACollege = sequelize.define('NCAACollege', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [2, 255]
      },
      set(value) {
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
        this.setDataValue('state', value.toUpperCase());
      }
    },
    
    division: {
      type: DataTypes.ENUM('ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia'),
      allowNull: false,
      validate: {
        isIn: [['ncaa_d1', 'ncaa_d2', 'ncaa_d3', 'naia']]
      }
    },
    
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    }
  }, {
    tableName: 'ncaa_colleges',
    timestamps: true,
    underscored: true,
    
    indexes: [
      {
        fields: ['state']
      },
      {
        fields: ['division']
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
  NCAACollege.findByDivision = async function(division) {
    return await this.findAll({
      where: { 
        division: division,
        isActive: true 
      },
      order: [['state', 'ASC'], ['name', 'ASC']]
    });
  };

  NCAACollege.findActiveColleges = async function() {
    return await this.findAll({
      where: { isActive: true },
      order: [['division', 'ASC'], ['state', 'ASC'], ['name', 'ASC']]
    });
  };

  // Les associations seront définies quand on créera CoachProfile
  NCAACollege.associate = function(models) {
    // Un college NCAA peut avoir plusieurs coachs
    NCAACollege.hasMany(models.CoachProfile, {
      foreignKey: 'collegeId',
      as: 'coaches'
    });
  };

  return NCAACollege;
};