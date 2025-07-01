// portall/client/src/services/referenceDataService.js
import api from './api';

class ReferenceDataService {
  /**
   * Charger la liste des colleges NJCAA
   * Cette fonction sera appelée quand l'utilisateur sélectionne "player"
   */
  static async getNJCAAColleges() {
    try {
      const response = await api.get('/reference/njcaa-colleges');
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error loading NJCAA colleges:', error);
      return {
        success: false,
        message: 'Failed to load colleges list'
      };
    }
  }

  /**
   * Charger la liste des colleges NCAA/NAIA
   * Cette fonction sera appelée quand l'utilisateur sélectionne "coach"
   */
  static async getNCAColleges() {
    try {
      const response = await api.get('/reference/ncaa-colleges');
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error loading NCAA colleges:', error);
      return {
        success: false,
        message: 'Failed to load colleges list'
      };
    }
  }
}

export default ReferenceDataService;