import React, { useState, useEffect } from 'react';
import { fetchUsers, fetchProjects, fetchProjectUsers, grantProjectAccess, revokeProjectAccess, registerUser, deleteUser, fetchAIStatus } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showAlert, showConfirm, showError } from '../utils/alerts';

function AdminPage() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectUsers, setProjectUsers] = useState([]);

  // Create User Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('stakeholder'); // Default to stakeholder!
  const [creatingUser, setCreatingUser] = useState(false);
  const [createError, setCreateError] = useState('');
  const [aiStatus, setAiStatus] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const usersData = await fetchUsers();
      setUsers(usersData);
      const projectsData = await fetchProjects();
      setProjects(projectsData);
    } catch (err) {
      console.error('Error fetching admin data', err);
    }
    try {
      setAiStatus(await fetchAIStatus());
    } catch (err) {
      console.error('Error fetching AI status', err);
    }
  };

  const loadProjectUsers = async (projectId) => {
    setSelectedProjectId(projectId);
    try {
      const data = await fetchProjectUsers(projectId);
      setProjectUsers(data.map(u => u.id));
    } catch (err) {
      console.error('Error fetching project users', err);
    }
  };

  const handleGrantAccess = async (userId) => {
    if (!selectedProjectId) return;
    try {
      await grantProjectAccess(selectedProjectId, userId);
      loadProjectUsers(selectedProjectId);
    } catch (err) {
      console.error('Error granting access', err);
    }
  };

  const handleRevokeAccess = async (userId) => {
    if (!selectedProjectId) return;
    const confirmed = await showConfirm({
      title: 'Revoke Access?',
      text: 'Revoke access for this user from the project?',
      confirmText: 'Revoke',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await revokeProjectAccess(selectedProjectId, userId);
      loadProjectUsers(selectedProjectId);
    } catch (err) {
      console.error('Error revoking access', err);
    }
  };

  const handleDeleteUser = async (userId, targetUsername) => {
    if (currentUser?.username === targetUsername) {
      showAlert('Cannot delete yourself!', 'warning');
      return;
    }
    const confirmed = await showConfirm({
      title: 'Delete User?',
      text: `Are you sure you want to delete user "${targetUsername}"? This will revoke project access rules and remove task user assignments.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteUser(userId);
      await loadData();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to delete user.', 'Cannot delete user');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || creatingUser) return;
    setCreatingUser(true);
    setCreateError('');
    try {
      await registerUser({ username, password, role });
      setUsername('');
      setPassword('');
      setRole('viewer');
      setShowCreateModal(false);
      await loadData();
    } catch (err) {
      setCreateError(err.response?.data?.detail || 'Failed to create user.');
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Admin Dashboard</h2>
        {activeTab === 'users' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-sm transition-colors shadow-lg shadow-blue-600/10"
          >
            + Create User
          </button>
        )}
      </div>

      {aiStatus && (
        <div data-testid="ai-status-card" className="mb-6 bg-slate-800/50 rounded-xl border border-slate-700 p-4 flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">AI provider</div>
            <div className="text-sm text-white font-medium">{aiStatus.provider}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Model</div>
            <div className="text-sm text-white font-medium">{aiStatus.model || '—'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Status</div>
            <div className={`text-sm font-medium ${aiStatus.reachable ? 'text-emerald-400' : 'text-red-400'}`}>
              {aiStatus.reachable ? 'Reachable' : 'Unreachable'}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Evaluation</div>
            <div className="text-sm text-slate-300">
              {aiStatus.evaluation
                ? <><span className={aiStatus.evaluation.passed ? 'text-emerald-400' : 'text-red-400'}>{aiStatus.evaluation.passed ? 'Passed' : 'Failed'}</span> · {aiStatus.evaluation.summary}</>
                : 'Not evaluated'}
            </div>
          </div>
        </div>
      )}

      <div className="flex space-x-4 mb-6">
        <button
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'access' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          onClick={() => setActiveTab('access')}
        >
          Project Access
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="px-6 py-3 text-xs font-medium text-slate-400 uppercase">ID</th>
                <th className="px-6 py-3 text-xs font-medium text-slate-400 uppercase">Username</th>
                <th className="px-6 py-3 text-xs font-medium text-slate-400 uppercase">Role</th>
                <th className="px-6 py-3 text-xs font-medium text-slate-400 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-slate-800/80">
                  <td className="px-6 py-4 text-sm text-slate-300">{user.id}</td>
                  <td className="px-6 py-4 text-sm text-white font-medium">{user.username}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      user.role === 'scrum_master' ? 'bg-amber-500/20 text-amber-400' :
                      user.role === 'developer' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {user.role === 'scrum_master' ? 'Scrum Master' :
                       user.role === 'developer' ? 'Developer' :
                       'Stakeholder'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    {currentUser?.username !== user.username ? (
                      <button
                        onClick={() => handleDeleteUser(user.id, user.username)}
                        className="px-2.5 py-1 rounded bg-red-950/40 text-red-400 hover:bg-red-900/40 border border-red-900/30 transition-colors text-xs font-semibold"
                      >
                        Delete
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500 italic">Active Self</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'access' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-800/50 p-6 rounded-xl border border-slate-700">
          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-3">Select Project</h3>
            <div className="space-y-2">
              {projects.map(project => (
                <button
                  key={project.id}
                  onClick={() => loadProjectUsers(project.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${selectedProjectId === project.id ? 'bg-blue-900/40 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                >
                  {project.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-400 mb-3">Manage Users</h3>
            {selectedProjectId ? (
              <div className="space-y-2">
                {users.map(user => {
                  const hasAccess = projectUsers.includes(user.id);
                  const isUserAdmin = user.role === 'scrum_master';
                  return (
                    <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-700">
                      <div>
                        <span className="text-white font-medium">{user.username}</span>
                        {isUserAdmin && <span className="ml-2 text-xs text-amber-500">(Scrum Master)</span>}
                      </div>
                      
                      {isUserAdmin ? (
                        <span className="px-3 py-1 text-xs text-slate-500 font-medium">Global Access</span>
                      ) : hasAccess ? (
                        <button
                          onClick={() => handleRevokeAccess(user.id)}
                          className="px-3 py-1 text-xs font-semibold rounded bg-red-950/40 text-red-400 border border-red-900/30 hover:bg-red-900/40 transition-colors"
                        >
                          Revoke
                        </button>
                      ) : (
                        <button
                          onClick={() => handleGrantAccess(user.id)}
                          className="px-3 py-1 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                        >
                          Grant
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-slate-500 py-8 text-center italic">
                Select a project first
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
            <h3 className="text-base font-bold text-white mb-4">Create User</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="Username"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="Password"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Role Type</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="stakeholder">Stakeholder (Read-only)</option>
                  <option value="developer">Developer (Task Planner)</option>
                  <option value="scrum_master">Scrum Master (Full access)</option>
                </select>
              </div>
              
              {createError && (
                <div className="p-3 bg-red-500/15 border border-red-500/20 rounded-lg text-xs text-red-400">
                  {createError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser || !username.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {creatingUser ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
