// portall/client/src/services/api.js

import axios from 'axios';

// Configuration de base d'Axios
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Créer une instance Axios avec configuration personnalisée
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 secondes de timeout
  headers: {
    'Content-Type': 'application/json',
  }
});

// Fonction pour obtenir le token depuis le localStorage
const getToken = () => {
  try {
    return localStorage.getItem('accessToken');
  } catch (error) {
    console.error('Error reading token from localStorage:', error);
    return null;
  }
};

// Fonction pour obtenir le refresh token
const getRefreshToken = () => {
  try {
    return localStorage.getItem('refreshToken');
  } catch (error) {
    console.error('Error reading refresh token from localStorage:', error);
    return null;
  }
};

// Fonction pour sauvegarder les tokens
const setTokens = (accessToken, refreshToken) => {
  try {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  } catch (error) {
    console.error('Error saving tokens to localStorage:', error);
  }
};

// Fonction pour supprimer les tokens
const removeTokens = () => {
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  } catch (error) {
    console.error('Error removing tokens from localStorage:', error);
  }
};

// Variable pour éviter les boucles infinies lors du refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Intercepteur pour ajouter automatiquement le token aux requêtes
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les réponses et le refresh automatique des tokens
api.interceptors.response.use(
  (response) => {
    // Si la réponse est OK, on la retourne telle quelle
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Si l'erreur est 401 (Unauthorized) et qu'on n'a pas déjà essayé de refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Si un refresh est déjà en cours, on met la requête en attente
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();
      
      if (refreshToken) {
        try {
          // Essayer de rafraîchir le token
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken: refreshToken
          });
          
          const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data.tokens;
          
          // Sauvegarder les nouveaux tokens
          setTokens(newAccessToken, newRefreshToken);
          
          // Mettre à jour le header de la requête originale
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          
          // Traiter la queue des requêtes en attente
          processQueue(null, newAccessToken);
          
          // Relancer la requête originale
          return api(originalRequest);
        } catch (refreshError) {
          // Le refresh a échoué, déconnecter l'utilisateur
          processQueue(refreshError, null);
          removeTokens();
          
          // Rediriger vers la page de login
          window.location.href = '/login';
          
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        // Pas de refresh token, déconnecter l'utilisateur
        removeTokens();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export { api, setTokens, removeTokens, getToken, getRefreshToken };
export default api;