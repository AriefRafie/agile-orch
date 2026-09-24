import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { fetchSprints, fetchSprintTasks, exportSprintPDF } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showError } from '../utils/alerts';

function SprintHistoryPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSprintId, setExpandedSprintId] = useState(null);
  const [sprintTasks, setSprintTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchSprints(projectId);
      // Filter only completed sprints
      const completed = data.filter(s => s.status === 'completed');
      setSprints(completed);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load completed sprints', err);
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleExpandSprint = async (sprintId) => {
    if (expandedSprintId === sprintId) {
      setExpandedSprintId(null);
      setSprintTasks([]);
      return;
    }
    setExpandedSprintId(sprintId);
    setLoadingTasks(true);
    try {
      const tasks = await fetchSprintTasks(sprintId);
      setSprintTasks(tasks);
    } catch (err) {
      console.error('Failed to load tasks for historical sprint', err);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleDownloadReport = async (sprintId, sprintName) => {
    try {
      await exportSprintPDF(sprintId, `${sprintName.replace(/\s+/g, '_')}_Report.pdf`);
    } catch (err) {
      showError('Failed to generate PDF report.', 'Export failed');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading sprint history...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-bold text-white leading-tight">Sprint History</h2>
          <p className="text-xs text-slate-500 mt-1">Review archive logs of all completed sprints in this project.</p>
        </div>
      </div>

      {sprints.length === 0 ? (
        <div className="card p-12 text-center text-slate-500 flex flex-col items-center justify-center border-dashed min-h-[250px]">
          <svg className="w-12 h-12 text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h3 className="text-base font-semibold text-white">No Completed Sprints</h3>
          <p className="text-xs text-slate-600 max-w-sm mt-1">
            Historical sprints will be displayed here once they are completed by finishing all their assigned tasks.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sprints.map(sprint => {
            const isExpanded = expandedSprintId === sprint.id;
            return (
              <div key={sprint.id} className="card p-5 border border-slate-800/80 bg-slate-900/40 hover:border-slate-700/50 transition-all space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">{sprint.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Duration {sprint.start_date} to {sprint.end_date} · Capacity committed {sprint.velocity}h
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadReport(sprint.id, sprint.name)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-600/20 transition-all text-xs font-semibold"
                    >
                      Download Report PDF
                    </button>
                    <button
                      onClick={() => handleExpandSprint(sprint.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all text-xs font-semibold"
                    >
                      {isExpanded ? 'Hide Tasks' : 'Show Tasks'}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-800 pt-4 mt-2">
                    <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Completed Tasks:</h4>
                    {loadingTasks ? (
                      <div className="text-xs text-slate-500 italic py-2">Loading tasks...</div>
                    ) : sprintTasks.length === 0 ? (
                      <div className="text-xs text-slate-500 italic py-2">No tasks were assigned to this sprint.</div>
                    ) : (
                      <div className="space-y-2 max-w-2xl">
                        {sprintTasks.map(task => (
                          <div key={task.id} className="flex items-center justify-between p-2.5 rounded bg-slate-950/40 border border-slate-900 text-xs">
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-bold text-emerald-400">✓</span>
                              <span className="text-slate-300 font-medium truncate">{task.title}</span>
                              <span className="text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.2 rounded">{task.category}</span>
                            </div>
                            <span className="text-slate-500 shrink-0 font-medium">{task.estimated_hours}h</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SprintHistoryPage;
