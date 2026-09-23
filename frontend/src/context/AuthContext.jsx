import React, { createContext, useState, useContext, useEffect } from 'react';
import { isTokenExpired } from '../services/api';

const AuthContext = createContext(null);

// Ignore a token that has already expired so the app goes straight to /login
// instead of rendering the workspace and then bouncing on the first 401.
const clearStoredSession = () => {
  ['token', 'role', 'username', 'userId'].forEach((k) => localStorage.removeItem(k));
};

const loadStoredToken = () => {
  const token = localStorage.getItem('token');
  if (token && isTokenExpired(token)) {
    clearStoredSession();
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
    const savedId = localStorage.getItem('userId');
    if (token && savedRole && savedUsername) {
      // id is needed by the developer task filter (KanbanBoard) and capacity math
      setUser({ id: savedId ? Number(savedId) : undefined, username: savedUsername, role: savedRole });
    }
    setLoading(false);
  }, [token]);

  const login = (userData) => {
    localStorage.setItem('token', userData.access_token);
    localStorage.setItem('role', userData.role);
    localStorage.setItem('username', userData.username);
    localStorage.setItem('userId', String(userData.id));
    setToken(userData.access_token);
    setUser({ id: userData.id, username: userData.username, role: userData.role });
  };

  const logout = () => {
    clearStoredSession();
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
