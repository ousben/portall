// portall/client/src/services/dashboardService.js

import api from './api';

/**
 * Service pour gérer les appels API des dashboards utilisateurs
 * 
 * Ce service encapsule toute la logique d'appel aux endpoints dashboard
 * que vous avez créés dans PlayerController et CoachController.
 * 
 * Architecture : Séparation claire entre logique métier (dashboards) 
 * et logique d'authentification (authService)
 */
class DashboardService {
  // ========================
  // SERVICES POUR LES JOUEURS
  // ========================

  /**
   * Récupère le dashboard complet du joueur connecté
   * Utilise votre endpoint GET /api/players/dashboard
   */
  static async getPlayerDashboard() {
    try {
      const response = await api.get('/players/dashboard');
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error loading player dashboard:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to load dashboard'
      };
    }
  }

  /**
   * Récupère les analytics détaillées du joueur
   * Utilise votre endpoint GET /api/players/analytics
   */
  static async getPlayerAnalytics() {
    try {
      const response = await api.get('/players/analytics');
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error loading player analytics:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to load analytics'
      };
    }
  }

  /**
   * Met à jour le profil du joueur
   * Utilise votre endpoint PUT /api/players/profile
   */
  static async updatePlayerProfile(profileData) {
    try {
      const response = await api.put('/players/profile', profileData);
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error updating player profile:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update profile',
        errors: error.response?.data?.errors || []
      };
    }
  }

  /**
   * Contrôle la visibilité du profil joueur
   * Utilise votre endpoint POST /api/players/profile/visibility
   */
  static async toggleProfileVisibility(isVisible) {
    try {
      const response = await api.post('/players/profile/visibility', { isVisible });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error toggling profile visibility:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update visibility'
      };
    }
  }

  // ========================
  // SERVICES POUR LES COACHS
  // ========================

  /**
   * Récupère le dashboard complet du coach connecté
   * Utilise votre endpoint GET /api/coaches/dashboard
   */
  static async getCoachDashboard() {
    try {
      const response = await api.get('/coaches/dashboard');
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error loading coach dashboard:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to load dashboard'
      };
    }
  }

  /**
   * Récupère les analytics détaillées du coach
   * Utilise votre endpoint GET /api/coaches/analytics
   */
  static async getCoachAnalytics() {
    try {
      const response = await api.get('/coaches/analytics');
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error loading coach analytics:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to load analytics'
      };
    }
  }

  /**
   * Met à jour le profil du coach
   * Utilise votre endpoint PUT /api/coaches/profile
   */
  static async updateCoachProfile(profileData) {
    try {
      const response = await api.put('/coaches/profile', profileData);
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error updating coach profile:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update profile',
        errors: error.response?.data?.errors || []
      };
    }
  }

  /**
   * Récupère la liste des favoris du coach avec filtres
   * Utilise votre endpoint GET /api/coaches/favorites
   */
  static async getCoachFavorites(filters = {}) {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const response = await api.get(`/coaches/favorites?${queryParams}`);
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error loading coach favorites:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to load favorites'
      };
    }
  }

  /**
   * Recherche de joueurs pour les coachs
   * Utilise votre endpoint GET /api/players/search
   */
  static async searchPlayers(searchCriteria = {}) {
    try {
      const queryParams = new URLSearchParams(searchCriteria).toString();
      const response = await api.get(`/players/search?${queryParams}`);
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error searching players:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to search players'
      };
    }
  }

  /**
   * Ajouter un joueur aux favoris
   * Utilise votre endpoint POST /api/coaches/favorites/:playerId
   */
  static async addPlayerToFavorites(playerId, favoriteData = {}) {
    try {
      const response = await api.post(`/coaches/favorites/${playerId}`, favoriteData);
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error adding to favorites:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to add to favorites'
      };
    }
  }

  /**
   * Récupère les recherches sauvegardées du coach
   * Utilise votre endpoint GET /api/coaches/saved-searches
   */
  static async getSavedSearches() {
    try {
      const response = await api.get('/coaches/saved-searches');
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error loading saved searches:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to load saved searches'
      };
    }
  }
}

export default DashboardService;