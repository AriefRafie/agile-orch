import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import ProtectedRoute from './ProtectedRoute';
import DashboardLayout from '../layouts/DashboardLayout';
import ProjectsPage from '../pages/ProjectsPage';
import BacklogPage from '../pages/BacklogPage';
import SprintPlanningPage from '../pages/SprintPlanningPage';
import ActiveSprintPage from '../pages/ActiveSprintPage';
import SprintHistoryPage from '../pages/SprintHistoryPage';
import RetrospectivePage from '../pages/RetrospectivePage';
import AnalyticsPage from '../pages/AnalyticsPage';
import AdminPage from '../pages/AdminPage';
import Login from '../components/Login';
import Register from '../components/Register';

const ProjectRedirect = () => {
  const { user } = useAuth();
  const { projectId } = useParams();
  const target = user?.role === 'scrum_master' ? 'backlog' : 'active';
  return <Navigate to={`/projects/${projectId}/${target}`} replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected Application Workspace Layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* Root Redirect to Projects */}
            <Route index element={<Navigate to="/projects" replace />} />

            {/* Project List Landing Page */}
            <Route path="projects" element={<ProjectsPage />} />

            {/* Tabbed Project Routing Flow */}
            <Route path="projects/:projectId" element={<ProjectRedirect />} />
            <Route
              path="projects/:projectId/backlog"
              element={
                <ProtectedRoute allowedRoles={['scrum_master']}>
                  <BacklogPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="projects/:projectId/planning"
              element={
                <ProtectedRoute allowedRoles={['scrum_master']}>
                  <SprintPlanningPage />
                </ProtectedRoute>
              }
            />
            <Route path="projects/:projectId/active" element={<ActiveSprintPage />} />
            <Route path="projects/:projectId/history" element={<SprintHistoryPage />} />
            <Route path="projects/:projectId/retro" element={<RetrospectivePage />} />
            <Route path="projects/:projectId/analytics" element={<AnalyticsPage />} />

            {/* Admin Dashboard */}
            <Route
              path="admin"
              element={
                <ProtectedRoute allowedRoles={['scrum_master']}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Wildcard Catchall */}
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
