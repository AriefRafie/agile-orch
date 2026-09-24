import React, { useState, useEffect } from 'react';
import { NavLink, useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { projectId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'scrum_master';

  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  // Helper to determine active route
  const isRouteActive = (path) => {
    return location.pathname === path;
  };

  const navItems = [
    {
      to: '/projects',
      label: 'Projects',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      )
    },
    isAdmin && {
      to: projectId ? `/projects/${projectId}/backlog` : '#',
      label: 'Backlog',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      disabled: !projectId
    },
    isAdmin && {
      to: projectId ? `/projects/${projectId}/planning` : '#',
      label: 'Sprint Planning',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      ),
      disabled: !projectId
    },
    {
      to: projectId ? `/projects/${projectId}/active` : '#',
      label: 'Sprints',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      disabled: !projectId
    },
    {
      to: projectId ? `/projects/${projectId}/retro` : '#',
      label: 'Retrospective',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      disabled: !projectId
    },
    {
      to: projectId ? `/projects/${projectId}/analytics` : '#',
      label: 'Analytics',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
        </svg>
      ),
      disabled: !projectId
    }
  ].filter(Boolean);

  return (
    <>
      {/* Desktop Collapsible Left Sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 h-screen sticky top-0 shrink-0 ${
          isCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
          {!isCollapsed && (
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/projects')}>
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-sm">
                AS
              </div>
              <span className="text-base font-bold text-white tracking-tight">AutoSprint</span>
            </div>
          )}
          {isCollapsed && (
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-sm mx-auto" onClick={() => navigate('/projects')}>
              AS
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${
              isCollapsed ? 'mt-2 mx-auto' : ''
            }`}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isCollapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item, index) => {
            const isActive = item.to !== '#' && isRouteActive(item.to);
            const disabled = item.disabled;

            return (
              <NavLink
                key={index}
                to={disabled ? '#' : item.to}
                onClick={(e) => disabled && e.preventDefault()}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  disabled
                    ? 'text-slate-600 cursor-not-allowed opacity-50'
                    : isActive
                    ? 'bg-slate-800 text-white shadow-md border border-slate-700/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <div className={`shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`}>
                  {item.icon}
                </div>
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}

          {/* Admin panel menu option if admin */}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-md border border-slate-700/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`
              }
              title={isCollapsed ? 'Admin' : undefined}
            >
              <div className="shrink-0 text-amber-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              {!isCollapsed && <span className="truncate">Admin</span>}
            </NavLink>
          )}
        </nav>

        {/* User Info & Logout Footer */}
        <div className="p-4 border-t border-slate-800 shrink-0 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
              {user?.username?.substring(0, 2).toUpperCase() || 'US'}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{user?.username}</p>
                <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50 uppercase tracking-wider">
                  {user?.role}
                </span>
              </div>
            )}
          </div>
          
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title={isCollapsed ? 'Log out' : undefined}
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-6 0V6a3 3 0 016 0v1" />
            </svg>
            {!isCollapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar (Screens < 768px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex items-center justify-around py-2 px-4 z-40">
        <NavLink
          to="/projects"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
              isActive ? 'text-blue-400' : 'text-slate-400'
            }`
          }
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span className="text-[10px] font-medium">Projects</span>
        </NavLink>

        <NavLink
          to={projectId ? `/projects/${projectId}` : '#'}
          onClick={(e) => !projectId && e.preventDefault()}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
              !projectId ? 'text-slate-600 opacity-50 cursor-not-allowed' : isActive ? 'text-blue-400' : 'text-slate-400'
            }`
          }
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[10px] font-medium">Dashboard</span>
        </NavLink>

        <NavLink
          to={projectId ? `/projects/${projectId}/sprint` : '#'}
          onClick={(e) => !projectId && e.preventDefault()}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
              !projectId ? 'text-slate-600 opacity-50 cursor-not-allowed' : isActive ? 'text-blue-400' : 'text-slate-400'
            }`
          }
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-[10px] font-medium">Sprints</span>
        </NavLink>

        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                isActive ? 'text-amber-400' : 'text-slate-400'
              }`
            }
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            </svg>
            <span className="text-[10px] font-medium">Admin</span>
          </NavLink>
        )}
      </nav>
    </>
  );
};

export default Sidebar;
