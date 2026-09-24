import React, { useState, useEffect } from 'react';
import { fetchProjects, createProject, deleteProject } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showConfirm } from '../utils/alerts';

function ProjectList({ onSelectProject }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === 'scrum_master';

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await fetchProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      await createProject({ name: newProjectName, description: newProjectDesc });
      setNewProjectName('');
      setNewProjectDesc('');
      loadProjects();
    } catch (err) {
      console.error('Failed to create project', err);
    }
  };

  const handleDeleteProject = async (e, projectId) => {
    e.stopPropagation();
    const confirmed = await showConfirm({
      title: 'Delete Project?',
      text: 'Are you sure you want to delete this project and all its tasks?',
      confirmText: 'Delete Project',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteProject(projectId);
      loadProjects();
    } catch (err) {
      console.error('Failed to delete project', err);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading projects...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h2 className="text-2xl font-bold text-white mb-6">Your Projects</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(project => (
          <div 
            key={project.id} 
            onClick={() => onSelectProject(project)}
            className="cursor-pointer bg-slate-800/50 p-5 rounded-xl border border-slate-700 hover:border-blue-500 transition-colors hover:shadow-lg hover:shadow-blue-500/10 relative group"
          >
            {isAdmin && (
              <button
                onClick={(e) => handleDeleteProject(e, project.id)}
                className="absolute top-3 right-3 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete Project"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <h3 className="text-lg font-semibold text-white mb-2 pr-6">{project.name}</h3>
            <p className="text-slate-400 text-sm line-clamp-2">{project.description || 'No description provided.'}</p>
          </div>
        ))}
        {projects.length === 0 && !isAdmin && (
          <div className="col-span-full text-center py-12 text-slate-500">
            You do not have access to any projects. Contact an administrator.
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="mt-12 bg-slate-800/50 p-6 rounded-xl border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-4">Create New Project</h3>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Project Name</label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                placeholder="e.g. Phoenix Overhaul"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
              <textarea
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                placeholder="Brief description of the project goals..."
                rows="3"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              disabled={!newProjectName.trim()}
            >
              Create Project
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default ProjectList;
