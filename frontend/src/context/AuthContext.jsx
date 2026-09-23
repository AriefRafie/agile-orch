import React, { createContext, useState, useContext, useEffect } from 'react';
import { isTokenExpired } from '../services/api';

const AuthContext = createContext(null);

// Ignore a token that has already expired so the app goes straight to /login
// instead of rendering the workspace and then bouncing on the first 401.
const loadStoredToken = () => {
  const token = localStorage.getItem('token');
  if (token && isTokenExpired(token)) {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    return null;
  }
  return token;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(loadStoredToken);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedRole = localStorage.getItem('role');
    const savedUsername = localStorage.getItem('username');
    if (token && savedRole && savedUsername) {
      setUser({ username: savedUsername, role: savedRole });
    }
    setLoading(false);
  }, [token]);

  const login = (userData) => {
    localStorage.setItem('token', userData.access_token);
    localStorage.setItem('role', userData.role);
    localStorage.setItem('username', userData.username);
    setToken(userData.access_token);
    setUser({ username: userData.username, role: userData.role });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
