// portall/client/src/contexts/AuthContext.jsx

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import AuthService from '../services/authService';
import toast from 'react-hot-toast';

// Actions possibles pour le reducer (inchangé)
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  REGISTER_START: 'REGISTER_START',
  REGISTER_SUCCESS: 'REGISTER_SUCCESS',
  REGISTER_FAILURE: 'REGISTER_FAILURE',
  LOGOUT: 'LOGOUT',
  SET_USER: 'SET_USER',
  SET_LOADING: 'SET_LOADING',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// État initial (inchangé)
const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isInitialized: false
};

// Reducer (inchangé)
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
    case AUTH_ACTIONS.REGISTER_START:
      return {
        ...state,
        isLoading: true,
        error: null
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        isInitialized: true
      };

    case AUTH_ACTIONS.REGISTER_SUCCESS:
      return {
        ...state,
        isLoading: false,
        error: null
      };

    case AUTH_ACTIONS.LOGIN_FAILURE:
    case AUTH_ACTIONS.REGISTER_FAILURE:
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload.message,
        isInitialized: true
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        isInitialized: true
      };

    case AUTH_ACTIONS.SET_USER:
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: !!action.payload.user,
        isInitialized: true
      };

    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    default:
      return state;
  }
};

// Création du Context
const AuthContext = createContext();

// Provider du Context
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // CORRECTION MAJEURE : Stabiliser les fonctions avec useCallback
  // Ces fonctions ne changeront que si leurs dépendances changent vraiment
  
  const clearError = useCallback(() => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  }, []); // Pas de dépendances car dispatch est stable

  const initializeAuth = useCallback(async () => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    
    try {
      if (AuthService.isAuthenticated()) {
        const result = await AuthService.getProfile();
        
        if (result.success) {
          dispatch({
            type: AUTH_ACTIONS.SET_USER,
            payload: { user: result.user }
          });
        } else {
          await AuthService.logout();
          dispatch({ type: AUTH_ACTIONS.LOGOUT });
        }
      } else {
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: { user: null } });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      await AuthService.logout();
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  }, []); // Pas de dépendances car nous utilisons dispatch et des services stables

  const login = useCallback(async (email, password) => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });
    
    try {
      const result = await AuthService.login(email, password);
      
      if (result.success) {
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user: result.user }
        });
        
        toast.success('Welcome back! Login successful.');
        return { success: true };
      } else {
        dispatch({
          type: AUTH_ACTIONS.LOGIN_FAILURE,
          payload: { message: result.message }
        });
        
        if (result.code === 'ACCOUNT_NOT_ACTIVE') {
          toast.error('Your account is pending admin approval.');
        } else {
          toast.error(result.message || 'Login failed');
        }
        
        return { success: false, message: result.message, code: result.code };
      }
    } catch (error) {
      const errorMessage = 'An unexpected error occurred during login';
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: { message: errorMessage }
      });
      toast.error(errorMessage);
      return { success: false, message: errorMessage };
    }
  }, []); // Pas de dépendances car nous utilisons dispatch et des services stables

  const register = useCallback(async (userData) => {
    dispatch({ type: AUTH_ACTIONS.REGISTER_START });
    
    try {
      const result = await AuthService.register(userData);
      
      if (result.success) {
        dispatch({ type: AUTH_ACTIONS.REGISTER_SUCCESS });
        
        toast.success('Account created successfully! Please wait for admin approval.');
        return { success: true, message: result.message };
      } else {
        dispatch({
          type: AUTH_ACTIONS.REGISTER_FAILURE,
          payload: { message: result.message }
        });
        
        if (result.errors && result.errors.length > 0) {
          result.errors.forEach(error => {
            toast.error(`${error.field}: ${error.message}`);
          });
        } else {
          toast.error(result.message || 'Registration failed');
        }
        
        return { success: false, message: result.message, errors: result.errors };
      }
    } catch (error) {
      const errorMessage = 'An unexpected error occurred during registration';
      dispatch({
        type: AUTH_ACTIONS.REGISTER_FAILURE,
        payload: { message: errorMessage }
      });
      toast.error(errorMessage);
      return { success: false, message: errorMessage };
    }
  }, []); // Pas de dépendances

  const logout = useCallback(async () => {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    
    try {
      await AuthService.logout();
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    } finally {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  }, []);

  // CORRECTION MAJEURE : useEffect avec dépendance stable
  // Maintenant initializeAuth ne change jamais, donc cet effect ne s'exécute qu'une fois
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]); // initializeAuth est maintenant stable grâce à useCallback

  // Valeurs exposées par le Context avec useCallback pour les fonctions
  const value = useCallback(() => ({
    // État
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    isInitialized: state.isInitialized,
    
    // Actions (maintenant stables)
    login,
    register,
    logout,
    clearError,
    
    // Utilitaires
    getCurrentUser: AuthService.getCurrentUser,
    isAuth: AuthService.isAuthenticated
  }), [
    state.user,
    state.isAuthenticated,
    state.isLoading,
    state.error,
    state.isInitialized,
    login,
    register,
    logout,
    clearError
  ]); // Les dépendances incluent tout ce qui peut changer

  return (
    <AuthContext.Provider value={value()}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personnalisé (inchangé)
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext;