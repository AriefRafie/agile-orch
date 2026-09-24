import React, { useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { updateTaskStatus } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showAlert, showError } from '../utils/alerts';

const COLUMNS = [
  { id: 'Todo', label: 'Todo', color: 'slate', icon: '○' },
  { id: 'In Progress', label: 'In Progress', color: 'blue', icon: '◎' },
  { id: 'Review', label: 'Review', color: 'purple', icon: '◈' },
  { id: 'Done', label: 'Done', color: 'emerald', icon: '●' },
];

const PRIORITY_COLORS = {
  5: 'bg-red-500/20 text-red-400 border-red-500/30',
  4: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  3: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  2: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  1: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const COLUMN_STYLES = {
  'Todo': 'border-t-slate-500',
  'In Progress': 'border-t-blue-500',
  'Review': 'border-t-purple-500',
  'Done': 'border-t-emerald-500',
};

const KanbanCard = ({ task, index, onExpand }) => {
  const isDone = task.status === 'Done';
  const riskFlags = task.risk_flags ? JSON.parse(task.risk_flags) : [];
  
  return (
    <Draggable draggableId={String(task.id)} index={index} isDragDisabled={false}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`p-3 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
            snapshot.isDragging
              ? 'bg-slate-700/90 border-blue-500/50 shadow-xl shadow-blue-500/10 rotate-1 scale-105'
              : isDone
              ? 'bg-slate-800/30 border-slate-800 opacity-60'
              : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
          }`}
          onClick={() => onExpand && onExpand(task)}
        >
          {/* Priority + Category */}
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS[1]}`}>
              P{task.priority}
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">
              {task.category || 'General'}
            </span>
            {riskFlags.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                ⚠ {riskFlags.length}
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className={`text-sm font-medium mb-1 ${isDone ? 'text-slate-500 line-through' : 'text-white'}`}>
            {task.title}
          </h4>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-slate-500 tabular-nums">{task.estimated_hours}h</span>
            
            <div className="flex items-center gap-2">
              {task.confidence_score != null && (
                <div className="flex items-center gap-1" title={`AI Confidence: ${Math.round(task.confidence_score * 100)}%`}>
                  <div className="w-8 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        task.confidence_score >= 0.8 ? 'bg-emerald-500' :
                        task.confidence_score >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${task.confidence_score * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="flex -space-x-1.5 overflow-hidden">
                {task.assignees && task.assignees.length > 0 ? (
                  task.assignees.map(u => (
                    <div
                      key={u.id}
                      className="w-5 h-5 rounded-full bg-blue-600 border border-slate-800 flex items-center justify-center text-[9px] text-white font-bold"
                      title={u.username}
                    >
                      {u.username.substring(0, 2).toUpperCase()}
                    </div>
                  ))
                ) : task.assigned_to_id ? (
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[9px] text-white font-bold">
                    U
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};

const KanbanBoard = ({ tasks, onAction, onExpandTask }) => {
  const { user } = useAuth();
  const canEdit = user?.role === 'scrum_master' || user?.role === 'developer';

  const columns = useMemo(() => {
    const cols = {};
    COLUMNS.forEach(c => { cols[c.id] = []; });
    
    const filteredTasks = tasks.filter(task => {
      if (user?.role === 'developer') {
        const isAssigned = task.assigned_to_id === user.id || 
                           (task.assignees && task.assignees.some(a => a.id === user.id));
        return isAssigned;
      }
      return true;
    });

    filteredTasks.forEach(task => {
      const status = cols[task.status] ? task.status : 'Todo';
      cols[status].push(task);
    });
    // Sort by priority within each column
    Object.keys(cols).forEach(key => {
      cols[key].sort((a, b) => b.priority - a.priority);
    });
    return cols;
  }, [tasks, user]);

  const handleDragEnd = async (result) => {
    if (!result.destination || !canEdit) return;

    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;
    const taskId = parseInt(draggableId);
    const task = tasks.find(t => t.id === taskId);
    
    if (!task || task.status === newStatus) return;

    if (task.status === 'Done' && (newStatus === 'Todo' || newStatus === 'Review')) {
      showAlert('Cannot move a completed task to Todo or Review. Only In Progress is allowed for rework.', 'warning');
      return;
    }

    try {
      await updateTaskStatus(taskId, newStatus);
      if (onAction) await onAction();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail) showError(detail, 'Cannot move task');
      else console.error('Status update failed:', err);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {COLUMNS.map(col => (
          <Droppable droppableId={col.id} key={col.id}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`card p-3 border-t-2 ${COLUMN_STYLES[col.id]} min-h-[200px] transition-colors ${
                  snapshot.isDraggingOver ? 'bg-slate-800/60 border-slate-600' : ''
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{col.icon}</span>
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">{col.label}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-md tabular-nums">
                    {columns[col.id].length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {columns[col.id].map((task, index) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      index={index}
                      onExpand={onExpandTask}
                    />
                  ))}
                  {provided.placeholder}
                </div>

                {columns[col.id].length === 0 && (
                  <div className="text-center py-8 text-slate-600">
                    <p className="text-xs">No tasks</p>
                  </div>
                )}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
};

export default KanbanBoard;
