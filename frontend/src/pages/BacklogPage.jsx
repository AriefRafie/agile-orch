import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPrioritizedTasks, fetchUsers, assignTask, deleteTask, completeTask } from '../services/api';
import TaskForm from '../components/TaskForm';
import DependencySelector from '../components/DependencySelector';
import AIInsightsPanel from '../components/AIInsightsPanel';
import { useAuth } from '../context/AuthContext';
import { showConfirm, showError } from '../utils/alerts';

const BacklogPage = () => {
  const { projectId } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'scrum_master';
  const canEdit = user?.role === 'scrum_master' || user?.role === 'developer';

  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [tasksRes, usersRes] = await Promise.all([
        fetchPrioritizedTasks(projectId),
        fetchUsers()
      ]);
      setTasks(tasksRes);
      setUsers(usersRes);
      
      // Update selected task reference if it exists
      if (selectedTask) {
        const updated = tasksRes.find(t => t.id === selectedTask.id);
        setSelectedTask(updated || null);
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to load backlog data', err);
      setLoading(false);
    }
  }, [projectId, selectedTask]);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleAssigneeChange = async (taskId, assigneeId) => {
    try {
      await assignTask(taskId, assigneeId ? parseInt(assigneeId) : null);
      await loadData();
    } catch (err) {
      console.error('Failed to assign task', err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    const confirmed = await showConfirm({
      title: 'Delete Task?',
      text: 'Are you sure you want to delete this task? This action cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteTask(taskId);
      if (selectedTask?.id === taskId) {
        setSelectedTask(null);
      }
      await loadData();
    } catch (err) {
      console.error('Failed to delete task', err);
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      await completeTask(taskId);
      await loadData();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to complete task', 'Cannot complete task');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading backlog...</div>;
  }

  // Filter tasks to only show those that are NOT in a sprint, or show all project tasks
  // (Backlog typically holds tasks not started, but let's show all tasks in a nice backlog list)
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Task Creator & List (7/12) */}
        <div className="xl:col-span-7 space-y-6">
          {canEdit && (
            <TaskForm onTaskAdded={loadData} projectId={projectId} />
          )}

          {/* Backlog List */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-slate-300">Project Backlog</h3>
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-md">
                {tasks.length} task{tasks.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {tasks.map(task => {
                const isSelected = selectedTask?.id === task.id;
                const isDone = task.status === 'Done';
                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-500/10 border-blue-500/30'
                        : isDone
                        ? 'bg-slate-900/40 border-slate-900 opacity-60'
                        : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                            {task.category || 'General'}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            task.priority >= 4 ? 'bg-red-500/15 text-red-400 border border-red-500/20' :
                            task.priority === 3 ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' :
                            'bg-slate-800 text-slate-400 border border-slate-700/50'
                          }`}>
                            P{task.priority}
                          </span>
                          {task.sprint_id && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-600/15 text-blue-400 border border-blue-600/20">
                              Sprint Active
                            </span>
                          )}
                        </div>
                        <h4 className={`text-sm font-semibold truncate ${isDone ? 'text-slate-500 line-through' : 'text-white'}`}>
                          {task.title}
                        </h4>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                        <span className="text-xs text-slate-500">{task.estimated_hours}h</span>

                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="w-7 h-7 rounded-md bg-slate-800/50 text-slate-500 hover:bg-red-500/10 hover:text-red-400 border border-slate-700/50 transition-colors flex items-center justify-center text-xs"
                            title="Delete Task"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {tasks.length === 0 && (
                <div className="text-center py-12 text-slate-600">
                  <p className="text-sm">Backlog is empty</p>
                  <p className="text-xs mt-1">
                    {isAdmin
                      ? "Create a new task above to populate the backlog."
                      : "No tasks have been created for this project yet. Contact your administrator."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Task Details, AI Insights, and Dependencies (5/12) */}
        <div className="xl:col-span-5">
          {selectedTask ? (
            <div className="card p-5 space-y-6 fade-in">
              {/* Task Title / Status */}
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/25">
                    {selectedTask.status}
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums">Estimate: {selectedTask.estimated_hours} hours</span>
                </div>
                <h3 className="text-base font-bold text-white leading-snug">{selectedTask.title}</h3>
                {selectedTask.description && (
                  <p className="text-xs text-slate-400 mt-2 bg-slate-900/40 p-3 rounded-lg border border-slate-800/50 leading-relaxed">
                    {selectedTask.description}
                  </p>
                )}
              </div>

              {/* Assignee Config */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 mb-1.5 block">Assign Users</label>
                <div className="space-y-1 bg-slate-900/60 border border-slate-700 rounded-lg p-3 max-h-[150px] overflow-y-auto">
                  {users.map(u => {
                    const isAssigned = (selectedTask.assignees || []).some(assignee => assignee.id === u.id) || selectedTask.assigned_to_id === u.id;
                    return (
                      <label key={u.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:text-white py-1">
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={isAssigned}
                          onChange={(e) => {
                            const currentIds = (selectedTask.assignees || []).map(assignee => assignee.id);
                            let newIds;
                            if (e.target.checked) {
                              newIds = [...new Set([...currentIds, u.id])];
                            } else {
                              newIds = currentIds.filter(id => id !== u.id);
                            }
                            handleAssigneeChange(selectedTask.id, newIds);
                          }}
                          className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500/50 focus:ring-offset-0"
                        />
                        <span>{u.username} ({u.role})</span>
                      </label>
                    );
                  })}
                  {users.length === 0 && (
                    <span className="text-xs text-slate-500">No users available</span>
                  )}
                </div>
              </div>

              {/* Dependency Linking (Contextual) */}
              {canEdit && (
                <div>
                  <DependencySelector
                    tasks={tasks}
                    currentTaskId={selectedTask.id}
                    onDependencyAdded={loadData}
                  />
                </div>
              )}

              {/* AI Insights display */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 mb-2 border-b border-slate-800 pb-1.5">AI Analysis & Risks</h4>
                <AIInsightsPanel
                  task={selectedTask}
                  projectId={projectId}
                  onSubtaskCreated={loadData}
                />
              </div>
            </div>
          ) : (
            <div className="card p-8 text-center text-slate-500 min-h-[300px] flex flex-col items-center justify-center border-dashed">
              <svg className="w-10 h-10 text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              <h4 className="text-sm font-semibold text-slate-400">No task selected</h4>
              <p className="text-xs mt-1 text-slate-600 max-w-xs leading-relaxed">
                Select any task from the backlog list to assign developers, link dependencies, and view AI insights.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BacklogPage;
