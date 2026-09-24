import React, { useMemo } from 'react';
import { deleteTask, completeTask } from '../services/api';
import TaskCard from './TaskCard';
import { showError } from '../utils/alerts';

const TaskList = ({ tasks, criticalIds, totalHours, onAction, projectId }) => {

  const idsThatArePrereqs = useMemo(() => {
    const set = new Set();
    tasks.forEach(t => {
      t.dependencies?.forEach(p => set.add(p.id));
    });
    return set;
  }, [tasks]);

  const handleAction = async (action, id) => {
    try {
      action === 'delete' ? await deleteTask(id) : await completeTask(id);
      if (onAction) await onAction();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail) showError(detail, action === 'delete' ? 'Cannot delete task' : 'Cannot complete task');
      else console.error(`Action [${action}] failed:`, err);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-300">Tasks</h3>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-md">
            {tasks.length}
          </span>
        </div>
        <span className="text-xs text-slate-500">
          {totalHours}h total
        </span>
      </div>

      <div className="space-y-2">
        {tasks.map(task => {
          const isTrueBottleneck = criticalIds.includes(task.id) && idsThatArePrereqs.has(task.id);
          return (
            <TaskCard
              key={task.id}
              task={task}
              isCritical={isTrueBottleneck}
              handleAction={handleAction}
              projectId={projectId}
              onSubtaskCreated={onAction}
            />
          );
        })}

        {tasks.length === 0 && (
          <div className="text-center py-12 text-slate-600">
            <p className="text-sm">No tasks yet</p>
            <p className="text-xs mt-1">Add a task above to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskList;