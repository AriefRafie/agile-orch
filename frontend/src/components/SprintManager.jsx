import React, { useState, useEffect } from 'react';
import { fetchSprints, createSprint, deleteSprint, autoAssignSprint, exportSprintPDF, updateSprint } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showConfirm, showAlert } from '../utils/alerts';

const SprintManager = ({ projectId, activeSprint, onSelectSprint }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'scrum_master';
  const [sprints, setSprints] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', velocity: 40 });

  useEffect(() => {
    if (projectId) loadSprints();
  }, [projectId]);

  const loadSprints = async () => {
    try {
      const data = await fetchSprints(projectId);
      setSprints(data);
    } catch (err) {
      console.error('Failed to load sprints', err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createSprint({ ...form, project_id: projectId });
      setForm({ name: '', start_date: '', end_date: '', velocity: 40 });
      setShowForm(false);
      loadSprints();
    } catch (err) {
      console.error('Failed to create sprint', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, sprintId) => {
    e.stopPropagation();
    if (!(await showConfirm({
      title: 'Delete Sprint?',
      text: 'Delete this sprint? Tasks will be unlinked but not deleted.',
      confirmText: 'Delete',
      danger: true,
    }))) return;
    try {
      await deleteSprint(sprintId);
      if (activeSprint?.id === sprintId) onSelectSprint(null);
      loadSprints();
    } catch (err) {
      console.error('Failed to delete sprint', err);
    }
  };

  const handleAutoAssign = async (e, sprintId) => {
    e.stopPropagation();
    try {
      const result = await autoAssignSprint(sprintId);
      showAlert(result.message, 'success');
      loadSprints();
    } catch (err) {
      console.error('Auto-assign failed', err);
    }
  };

  const handleExport = async (e, sprintId) => {
    e.stopPropagation();
    try {
      await exportSprintPDF(sprintId);
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  const handleActivate = async (e, sprint) => {
    e.stopPropagation();
    try {
      await updateSprint(sprint.id, { status: sprint.status === 'active' ? 'planning' : 'active' });
      loadSprints();
    } catch (err) {
      console.error('Sprint status update failed', err);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-300">Sprints</h3>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            {showForm ? 'Cancel' : '+ Sprint'}
          </button>
        )}
      </div>

      {/* Create Sprint Form */}
      {showForm && isAdmin && (
        <form onSubmit={handleCreate} className="mb-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-500 mb-1 block">Name</label>
              <input
                type="text" required placeholder="Sprint 1"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 mb-1 block">Velocity (hours)</label>
              <input
                type="number" required min="1" placeholder="40"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                value={form.velocity} onChange={e => setForm({ ...form, velocity: parseInt(e.target.value) || 40 })}
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 mb-1 block">Start</label>
              <input
                type="date" required
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 mb-1 block">End</label>
              <input
                type="date" required
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Sprint'}
          </button>
        </form>
      )}

      {/* Sprint List */}
      <div className="space-y-2">
        {sprints.map(sprint => {
          const isActive = activeSprint?.id === sprint.id;
          const capacityPct = sprint.velocity > 0 ? Math.min(100, (sprint.hours_used / sprint.velocity) * 100) : 0;

          return (
            <div
              key={sprint.id}
              onClick={() => onSelectSprint(isActive ? null : sprint)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                isActive
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : 'bg-slate-800/30 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{sprint.name}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    sprint.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                    sprint.status === 'completed' ? 'bg-slate-700 text-slate-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>
                    {sprint.status}
                  </span>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => handleActivate(e, sprint)} className="text-[10px] px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors" title="Toggle status">
                      {sprint.status === 'active' ? '⏸' : '▶'}
                    </button>
                    <button onClick={(e) => handleAutoAssign(e, sprint.id)} className="text-[10px] px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-blue-600 transition-colors" title="Auto-assign tasks">
                      ⚡
                    </button>
                    <button onClick={(e) => handleExport(e, sprint.id)} className="text-[10px] px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors" title="Export PDF">
                      📄
                    </button>
                    <button onClick={(e) => handleDelete(e, sprint.id)} className="text-[10px] px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-colors" title="Delete">
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="text-center">
                  <div className="text-sm font-bold text-white">{sprint.task_count}</div>
                  <div className="text-[10px] text-slate-500">tasks</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-white">{sprint.hours_used}/{sprint.velocity}h</div>
                  <div className="text-[10px] text-slate-500">capacity</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-white">{sprint.completion_pct}%</div>
                  <div className="text-[10px] text-slate-500">done</div>
                </div>
              </div>

              {/* Capacity Bar */}
              <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    capacityPct > 90 ? 'bg-red-500' : capacityPct > 70 ? 'bg-amber-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${capacityPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-slate-500">{sprint.start_date}</span>
                <span className="text-[10px] text-slate-500">{sprint.end_date}</span>
              </div>
            </div>
          );
        })}

        {sprints.length === 0 && (
          <div className="text-center py-6 text-slate-600">
            <p className="text-xs">No sprints yet.</p>
            {isAdmin && <p className="text-[10px] mt-1">Click "+ Sprint" to create one.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default SprintManager;
