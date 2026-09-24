import React, { useState, useEffect } from 'react';
import { Outlet, useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';
import { fetchProjects } from '../services/api';

const DashboardLayout = () => {
  const { user } = useAuth();
  const { projectId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('Project');

  useEffect(() => {
    const loadProjectName = async () => {
      if (!projectId) return;
      try {
        const projects = await fetchProjects();
        const active = projects.find(p => String(p.id) === String(projectId));
        if (active) {
          setProjectName(active.name);
        }
      } catch (err) {
        console.error('Failed to load project details for breadcrumbs', err);
      }
    };
    loadProjectName();
  }, [projectId]);

  // Determine current active sub-navigation page for breadcrumbs & tab highlighting
  const getSubPageInfo = () => {
    if (location.pathname.endsWith('/backlog')) return { id: 'backlog', label: 'Backlog' };
    if (location.pathname.endsWith('/planning')) return { id: 'planning', label: 'Sprint Planning' };
    if (location.pathname.endsWith('/active')) return { id: 'active', label: 'Sprints' };
    if (location.pathname.endsWith('/history')) return { id: 'history', label: 'History' };
    if (location.pathname.endsWith('/retro')) return { id: 'retro', label: 'Retrospective' };
    if (location.pathname.endsWith('/analytics')) return { id: 'analytics', label: 'Analytics' };
    return { id: 'backlog', label: 'Backlog' };
  };

  const currentSubPage = getSubPageInfo();

  const handleTabChange = (tabId) => {
    navigate(`/projects/${projectId}/${tabId}`);
  };

  const isScrumMaster = user?.role === 'scrum_master';

  const projectTabs = [
    isScrumMaster && { id: 'backlog', label: 'Backlog' },
    isScrumMaster && { id: 'planning', label: 'Sprint Planning' },
    { id: 'active', label: 'Sprints' },
    { id: 'history', label: 'History' },
    { id: 'retro', label: 'Retrospective' },
    { id: 'analytics', label: 'Analytics' }
  ].filter(Boolean);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 pb-16 md:pb-0">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Content Body Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Minimalist Top Navbar */}
        <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="md:hidden text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center font-bold text-white text-xs">AS</div>
              AutoSprint
            </span>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />
            <div 
              className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-xs shadow-inner cursor-pointer"
              title={user?.username}
            >
              {user?.username?.substring(0, 2).toUpperCase() || 'US'}
            </div>
          </div>
        </header>

        {/* Breadcrumb Navigation bar */}
        {projectId && (
          <div className="bg-slate-900/40 border-b border-slate-800/50 px-6 py-2 flex items-center gap-2 text-xs text-slate-500 shrink-0">
            <Link to="/projects" className="hover:text-white transition-colors">Projects</Link>
            <span>&gt;</span>
            <Link to={`/projects/${projectId}/backlog`} className="hover:text-white transition-colors">{projectName}</Link>
            <span>&gt;</span>
            <span className="text-white font-medium">{currentSubPage.label}</span>
          </div>
        )}

        {/* Project Context Sub-navigation Tabs */}
        {projectId && (
          <div className="bg-slate-900/20 px-6 pt-4 border-b border-slate-800 shrink-0 overflow-x-auto scrollbar-none">
            <div className="flex gap-2 min-w-max">
              {projectTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all duration-200 pb-3 ${
                    currentSubPage.id === tab.id
                      ? 'border-blue-500 text-white'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sub-view Content Outlet */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
