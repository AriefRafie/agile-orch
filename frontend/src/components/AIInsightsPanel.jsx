import React, { useState } from 'react';
import { fetchTaskActivity, createTask } from '../services/api';
import { timeAgo } from '../utils/timeAgo';

const RISK_LABELS = {
  security: { emoji: '🔴', label: 'Security Risk', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  performance: { emoji: '🟡', label: 'Performance Risk', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  scalability: { emoji: '🟠', label: 'Scalability Risk', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  data_loss: { emoji: '🔴', label: 'Data Loss Risk', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  breaking_change: { emoji: '⚠️', label: 'Breaking Change', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
};

const AIInsightsPanel = ({ task, projectId, onSubtaskCreated }) => {
  const [activityLog, setActivityLog] = useState([]);
  const [showActivity, setShowActivity] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [creatingSubtask, setCreatingSubtask] = useState(null);

  const confidence = task.confidence_score;
  const riskFlags = task.risk_flags ? JSON.parse(task.risk_flags) : [];
  const subtasks = task.suggested_subtasks ? JSON.parse(task.suggested_subtasks) : [];
  const rationale = task.ai_rationale || '';

  const loadActivity = async () => {
    if (showActivity) {
      setShowActivity(false);
      return;
    }
    setLoadingActivity(true);
    try {
      const data = await fetchTaskActivity(task.id);
      setActivityLog(data);
      setShowActivity(true);
    } catch (err) {
      console.error('Failed to load activity', err);
    } finally {
      setLoadingActivity(false);
    }
  };

  const handleCreateSubtask = async (subtaskTitle) => {
    setCreatingSubtask(subtaskTitle);
    try {
      await createTask({
        title: subtaskTitle,
        description: `Subtask of: ${task.title}`,
        project_id: projectId
      });
      if (onSubtaskCreated) onSubtaskCreated();
    } catch (err) {
      console.error('Failed to create subtask', err);
    } finally {
      setCreatingSubtask(null);
    }
  };

  const hasAIData = confidence != null || riskFlags.length > 0 || subtasks.length > 0 || rationale;

  if (!hasAIData) return null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-3">
      {(task.ai_provider || task.ai_needs_review) && (
        <div data-testid="ai-provenance" className="flex flex-wrap items-center gap-1.5 text-[10px]">
          {task.ai_is_fallback ? (
            <span className="px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20">
              Keyword fallback — AI was unavailable
            </span>
          ) : task.ai_model ? (
            <span className="text-slate-500">
              {task.ai_model} via {task.ai_provider}
              {task.ai_analyzed_at ? ` · analysed ${timeAgo(task.ai_analyzed_at)}` : ''}
            </span>
          ) : null}
          {task.ai_needs_review && (
            <span className="px-1.5 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20">
              Needs review
            </span>
          )}
        </div>
      )}
      {/* Confidence + Rationale */}
      <div className="flex items-start gap-3">
        {confidence != null && (
          <div className="shrink-0">
            <div className="text-[10px] text-slate-500 mb-1">AI Confidence</div>
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    confidence >= 0.8 ? 'bg-emerald-500' :
                    confidence >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <span className={`text-xs font-bold tabular-nums ${
                confidence >= 0.8 ? 'text-emerald-400' :
                confidence >= 0.5 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {Math.round(confidence * 100)}%
              </span>
            </div>
          </div>
        )}

        {rationale && (
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-slate-500 mb-1">AI Rationale</div>
            <p className="text-xs text-slate-400 leading-relaxed">{rationale}</p>
          </div>
        )}
      </div>

      {/* Risk Flags */}
      {riskFlags.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 mb-1.5">Risk Flags</div>
          <div className="flex flex-wrap gap-1.5">
            {riskFlags.map(flag => {
              const meta = RISK_LABELS[flag] || { emoji: '⚠️', label: flag, color: 'bg-slate-700 text-slate-400' };
              return (
                <span key={flag} className={`text-[10px] font-medium px-2 py-0.5 rounded border ${meta.color}`}>
                  {meta.emoji} {meta.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggested Subtasks */}
      {subtasks.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 mb-1.5">Suggested Subtasks</div>
          <div className="space-y-1">
            {subtasks.map((st, i) => (
              <div key={i} className="flex items-center justify-between gap-2 p-1.5 rounded bg-slate-800/50 border border-slate-700/50">
                <span className="text-xs text-slate-400 truncate">{st}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCreateSubtask(st); }}
                  disabled={creatingSubtask === st}
                  className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/20 transition-colors disabled:opacity-50"
                >
                  {creatingSubtask === st ? '...' : '+ Create'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Log Toggle */}
      <button
        onClick={loadActivity}
        className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
      >
        {loadingActivity ? 'Loading...' : showActivity ? '▾ Hide Activity' : '▸ Show Activity'}
      </button>

      {showActivity && activityLog.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {activityLog.map(log => (
            <div key={log.id} className="flex items-center gap-2 text-[10px] text-slate-500">
              <span className="shrink-0 w-1 h-1 rounded-full bg-slate-600"></span>
              <span className="text-slate-400">{log.detail || log.action}</span>
              <span className="text-slate-600 ml-auto shrink-0">
                {new Date(log.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AIInsightsPanel;
