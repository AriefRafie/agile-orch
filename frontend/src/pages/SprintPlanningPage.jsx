import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetchSprints,
  createSprint,
  deleteSprint,
  fetchTasks,
  updateSprint,
  updateTaskSprint
} from '../services/api';
import { useAuth } from '../context/AuthContext';

const SprintPlanningPage = () => {
  const { projectId } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'scrum_master';
  const canEdit = user?.role === 'scrum_master' || user?.role === 'developer';

  const [sprints, setSprints] = useState([]);
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [tasks, setTasks] = useState([]);
  const [activeSprint, setActiveSprint] = useState(null);

  // Sprint creation form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sprintForm, setSprintForm] = useState({ name: '', start_date: '', end_date: '', velocity: 40 });
  const [sprintError, setSprintError] = useState('');
  const [creatingSprint, setCreatingSprint] = useState(false);

  const loadSprints = useCallback(async () => {
    try {
      const data = await fetchSprints(projectId);
      const activeOrPlanningSprints = data.filter(s => s.status !== 'completed');
      setSprints(activeOrPlanningSprints);
      if (activeOrPlanningSprints.length > 0) {
        if (!selectedSprintId) {
          setSelectedSprintId(activeOrPlanningSprints[0].id);
          setActiveSprint(activeOrPlanningSprints[0]);
        } else {
          const current = activeOrPlanningSprints.find(s => String(s.id) === String(selectedSprintId));
          setActiveSprint(current || activeOrPlanningSprints[0]);
        }
      } else {
        setSelectedSprintId('');
        setActiveSprint(null);
      }
    } catch (err) {
      console.error('Failed to load sprints', err);
    }
  }, [projectId, selectedSprintId]);

  const loadTasks = useCallback(async () => {
    try {
      const data = await fetchTasks(projectId);
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks', err);
    }
  }, [projectId]);

  useEffect(() => {
    loadSprints();
    loadTasks();
  }, [projectId]);

  useEffect(() => {
    if (selectedSprintId && sprints.length > 0) {
      const current = sprints.find(s => String(s.id) === String(selectedSprintId));
      setActiveSprint(current || null);
    }
  }, [selectedSprintId, sprints]);

  const handleCreateSprint = async (e) => {
    e.preventDefault();
    if (!sprintForm.name.trim() || creatingSprint) return;
    if (sprintForm.end_date < sprintForm.start_date) {
      setSprintError('End date must be on or after the start date.');
      return;
    }
    setSprintError('');
    setCreatingSprint(true);
    try {
      const newSprint = await createSprint({ ...sprintForm, project_id: projectId });
      setSprintForm({ name: '', start_date: '', end_date: '', velocity: 40 });
      setShowCreateForm(false);
      setSelectedSprintId(newSprint.id);
      await loadSprints();
      await loadTasks();
    } catch (err) {
      console.error('Failed to create sprint', err);
      const detail = err.response?.data?.detail;
      setSprintError(
        typeof detail === 'string' ? detail : detail?.[0]?.msg || 'Failed to create sprint.'
      );
    } finally {
      setCreatingSprint(false);
    }
  };

  const handleDeleteSprint = async () => {
    if (!activeSprint) return;
    if (activeSprint.status === 'active') {
      alert("Cannot delete an active sprint. Please pause or complete the sprint first.");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the sprint "${activeSprint.name}"? Tasks assigned to this sprint will be returned to the backlog.`)) {
      return;
    }

    try {
      await deleteSprint(activeSprint.id);
      setSelectedSprintId('');
      await loadSprints();
      await loadTasks();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete sprint');
    }
  };

  const handleToggleStatus = async () => {
    if (!activeSprint) return;
    const nextStatus = activeSprint.status === 'active' ? 'planning' : 'active';
    try {
      await updateSprint(activeSprint.id, { status: nextStatus });
      await loadSprints();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleAddTaskToSprint = async (taskId) => {
    if (!selectedSprintId) return;
    try {
      await updateTaskSprint(taskId, parseInt(selectedSprintId));
      await loadTasks();
      await loadSprints(); // Updates sprint capacity metrics
    } catch (err) {
      console.error('Failed to add task to sprint', err);
    }
  };

  const handleRemoveTaskFromSprint = async (taskId) => {
    try {
      await updateTaskSprint(taskId, null);
      await loadTasks();
      await loadSprints();
    } catch (err) {
      console.error('Failed to remove task from sprint', err);
    }
  };

  // Reorder task list (moving priority)
  const handleMoveTask = async (task, direction) => {
    // We can simulate reordering by swapping task priority locally and saving it, 
    // but a simpler option is to update task priorities on demand or just reorder in UI.
    // For simplicity, let's notify the user or perform swap priority.
    console.log(`Moving task ${task.id} ${direction}`);
  };



  // Filter tasks
  const backlogPool = tasks.filter(t => !t.sprint_id && t.status !== 'Done');
  const sprintTasks = selectedSprintId
    ? tasks.filter(t => String(t.sprint_id) === String(selectedSprintId))
    : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header Sprint Selector */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-400">Target Sprint:</label>
          {sprints.length > 0 ? (
            <select
              value={selectedSprintId}
              onChange={(e) => { setSelectedSprintId(e.target.value); setSuggestedTaskIds([]); }}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {sprints.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-slate-500 italic">No Sprints created yet</span>
          )}

          {activeSprint && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              activeSprint.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
            }`}>
              {activeSprint.status}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeSprint && (
            <>
              {isAdmin && (
                <button
                  onClick={handleToggleStatus}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  {activeSprint.status === 'active' ? 'Pause Sprint' : 'Start Sprint'}
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={handleDeleteSprint}
                  className="px-3 py-1.5 bg-red-950/30 hover:bg-red-900/40 text-red-400 rounded-lg text-xs font-semibold transition-colors border border-red-900/30"
                >
                  Delete Sprint
                </button>
              )}
            </>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-lg shadow-blue-600/15"
            >
              + Create Sprint
            </button>
          )}
        </div>
      </div>

      {/* Create Sprint Modal */}
      {showCreateForm && isAdmin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowCreateForm(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
            <h3 className="text-base font-bold text-white mb-4">Create New Sprint</h3>
            <form onSubmit={handleCreateSprint} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Sprint Name</label>
                <input
                  type="text"
                  value={sprintForm.name}
                  onChange={(e) => setSprintForm({ ...sprintForm, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Sprint 1 - Core API"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={sprintForm.start_date}
                    max={sprintForm.end_date || undefined}
                    onChange={(e) => setSprintForm({ ...sprintForm, start_date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={sprintForm.end_date}
                    min={sprintForm.start_date || undefined}
                    onChange={(e) => setSprintForm({ ...sprintForm, end_date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    required
                  />
                </div>
              </div>
              {sprintError && (
                <p className="text-xs text-red-400">{sprintError}</p>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Velocity Capacity (Hours)</label>
                <input
                  type="number"
                  value={sprintForm.velocity}
                  onChange={(e) => setSprintForm({ ...sprintForm, velocity: parseInt(e.target.value) || 40 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  min="1"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingSprint}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {creatingSprint ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Split Planning Workspace */}
      {activeSprint ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column: Backlog Pool */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-300">Backlog Tasks Pool</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Tasks not assigned to any sprint.</p>
              </div>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {backlogPool.map(task => {
                return (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border border-slate-800 bg-slate-800/40 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-700 text-slate-400 rounded">
                          P{task.priority}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-white truncate">{task.title}</h4>
                      <span className="text-[10px] text-slate-500">{task.estimated_hours}h · {task.category}</span>
                    </div>

                    {canEdit && (
                      <button
                        onClick={() => handleAddTaskToSprint(task.id)}
                        className="shrink-0 w-8 h-8 rounded-lg bg-blue-600/15 text-blue-400 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center text-sm font-bold"
                        title="Add to Sprint"
                      >
                        →
                      </button>
                    )}
                  </div>
                );
              })}

              {backlogPool.length === 0 && (
                <div className="text-center py-12 text-slate-600">
                  <p className="text-xs">No backlog tasks available</p>
                  <p className="text-[10px] mt-1">Create backlog tasks first to plan them.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Target Sprint Tasks */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-300">Sprint Backlog ({activeSprint.name})</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Manually planned tasks for this sprint.</p>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-white tabular-nums">{activeSprint.hours_used} / {activeSprint.velocity}h</span>
                <p className="text-[10px] text-slate-500">sprint velocity used</p>
              </div>
            </div>

            {/* Capacity Progress Bar */}
            <div className="h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  activeSprint.hours_used > activeSprint.velocity ? 'bg-red-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, (activeSprint.hours_used / activeSprint.velocity) * 100)}%` }}
              />
            </div>

            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {sprintTasks.map((task, idx) => (
                <div
                  key={task.id}
                  className="p-3 rounded-lg border border-slate-800 bg-slate-800/40 flex items-center justify-between gap-3"
                >
                  {canEdit && (
                    <button
                      onClick={() => handleRemoveTaskFromSprint(task.id)}
                      className="shrink-0 w-8 h-8 rounded-lg bg-red-950/30 text-red-400 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center text-sm font-bold"
                      title="Remove from Sprint"
                    >
                      ←
                    </button>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-700 text-slate-400 rounded">
                        P{task.priority}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-white truncate">{task.title}</h4>
                    <span className="text-[10px] text-slate-500">{task.estimated_hours}h · {task.category}</span>
                  </div>

                  <div className="flex flex-col gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleMoveTask(task, 'up')} className="text-[10px] p-1 text-slate-500 hover:text-white transition-colors" title="Move Up">▲</button>
                    <button onClick={() => handleMoveTask(task, 'down')} className="text-[10px] p-1 text-slate-500 hover:text-white transition-colors" title="Move Down">▼</button>
                  </div>
                </div>
              ))}

              {sprintTasks.length === 0 && (
                <div className="text-center py-12 text-slate-600">
                  <p className="text-xs">Sprint is currently empty</p>
                  <p className="text-[10px] mt-1">Move backlog tasks to the sprint to fill capacity.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-12 text-center text-slate-500 flex flex-col items-center justify-center border-dashed">
          <svg className="w-12 h-12 text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="text-lg font-semibold text-white">No active sprint context</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-6 leading-relaxed">
            {isAdmin
              ? "Sprints are time-boxed iterations of work. Create your first sprint above to set velocities and assign tasks."
              : "There are no sprints planned for this project yet. Contact your administrator to schedule a sprint."}
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              + Create First Sprint
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SprintPlanningPage;
