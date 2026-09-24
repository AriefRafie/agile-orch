import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetchSprints,
  fetchSprintRetrospective,
  createSprintRetrospective,
  updateRetrospective,
  deleteRetrospective,
  addRetroItem,
  updateRetroItem,
  deleteRetroItem,
  voteRetroItem,
  fetchProjectUsers
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showAlert, showConfirm, showError, Swal } from '../utils/alerts';

const COLUMNS = [
  {
    key: 'went_well',
    title: 'Went Well',
    hint: 'What worked well this sprint? Keep doing it.',
    placeholder: 'e.g. Fast decision-making on the API layer',
    accent: 'emerald',
    icon: 'M5 13l4 4L19 7'
  },
  {
    key: 'to_improve',
    title: 'To Improve',
    hint: 'What slowed the team down or caused friction?',
    placeholder: 'e.g. Code reviews took too long',
    accent: 'amber',
    icon: 'M12 9v2m0 4h.01m-6.9 5h13.8a2 2 0 001.5-3.3L13.5 5.7a2 2 0 00-3 0L3.6 15.7a2 2 0 001.5 3.3z'
  },
  {
    key: 'action_item',
    title: 'Action Items',
    hint: 'Concrete, committed improvements with an owner.',
    placeholder: 'e.g. Schedule a 15-min review queue daily',
    accent: 'blue',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
  }
];

const ACCENT_STYLES = {
  emerald: {
    header: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    button: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/15',
    ring: 'focus:border-emerald-500'
  },
  amber: {
    header: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    button: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/15',
    ring: 'focus:border-amber-500'
  },
  blue: {
    header: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    button: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/15',
    ring: 'focus:border-blue-500'
  }
};

const RetrospectivePage = () => {
  const { projectId } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'scrum_master';
  const canEdit = user?.role === 'scrum_master' || user?.role === 'developer';

  const [sprints, setSprints] = useState([]);
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [retro, setRetro] = useState(null);
  const [projectUsers, setProjectUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({ went_well: '', to_improve: '', action_item: '' });
  const [draftOwners, setDraftOwners] = useState({ action_item: '' });
  const [busy, setBusy] = useState({});
  const [title, setTitle] = useState('');

  const loadSprints = useCallback(async () => {
    try {
      const data = await fetchSprints(projectId);
      setSprints(data);
      if (data.length > 0) {
        const initial = data.find(s => s.status === 'active') || data.find(s => s.status !== 'completed') || data[0];
        setSelectedSprintId(initial.id);
        setSelectedSprint(initial);
        return initial;
      }
      setSelectedSprint(null);
      setSelectedSprintId('');
      return null;
    } catch (err) {
      console.error('Failed to load sprints', err);
      return null;
    }
  }, [projectId]);

  const loadRetro = useCallback(async (sprintId) => {
    if (!sprintId) {
      setRetro(null);
      setLoading(false);
      return;
    }
    try {
      const data = await fetchSprintRetrospective(sprintId);
      setRetro(data);
      setTitle(data.title || '');
    } catch (err) {
      if (err.response?.status === 404) {
        setRetro(null);
      } else {
        console.error('Failed to load retrospective', err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProjectUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setProjectUsers(await fetchProjectUsers(projectId));
    } catch (err) {
      console.error('Failed to load project users', err);
    }
  }, [isAdmin, projectId]);

  useEffect(() => {
    loadProjectUsers();
  }, [loadProjectUsers]);

  useEffect(() => {
    (async () => {
      const sprint = await loadSprints();
      if (sprint) await loadRetro(sprint.id);
      else setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleSprintChange = async (sprintId) => {
    setSelectedSprintId(sprintId);
    const sprint = sprints.find(s => String(s.id) === String(sprintId));
    setSelectedSprint(sprint);
    setLoading(true);
    await loadRetro(sprintId);
  };

  const refreshRetro = async () => {
    await loadRetro(selectedSprintId);
  };

  const handleOpenRetro = async () => {
    try {
      setBusy(b => ({ ...b, open: true }));
      const created = await createSprintRetrospective(selectedSprintId, { title: `Retrospective — ${selectedSprint.name}` });
      setRetro(created);
      setTitle(created.title || '');
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to open retrospective', 'Cannot open retrospective');
    } finally {
      setBusy(b => ({ ...b, open: false }));
    }
  };

  const handleAddItem = async (category) => {
    const content = drafts[category];
    if (!content || !content.trim()) return;
    const payload = { category, content };
    if (category === 'action_item' && draftOwners.action_item) {
      payload.owner_id = parseInt(draftOwners.action_item, 10);
    }
    setBusy(b => ({ ...b, [category]: true }));
    try {
      await addRetroItem(retro.id, payload);
      setDrafts(d => ({ ...d, [category]: '' }));
      if (category === 'action_item') setDraftOwners(d => ({ ...d, action_item: '' }));
      await refreshRetro();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to add item', 'Cannot add item');
    } finally {
      setBusy(b => ({ ...b, [category]: false }));
    }
  };

  const handleVote = async (item) => {
    try {
      await voteRetroItem(retro.id, item.id);
      await refreshRetro();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to vote', 'Cannot vote');
    }
  };

  const handleToggleDone = async (item) => {
    try {
      await updateRetroItem(retro.id, item.id, { is_done: !item.is_done });
      await refreshRetro();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to update item', 'Cannot update item');
    }
  };

  const handleDeleteItem = async (item) => {
    const confirmed = await showConfirm({
      title: 'Delete Item?',
      text: 'Delete this item?',
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteRetroItem(retro.id, item.id);
      await refreshRetro();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to delete item', 'Cannot delete item');
    }
  };

  const handleSaveTitle = async () => {
    if (!retro || title.trim() === retro.title) return;
    try {
      const updated = await updateRetrospective(retro.id, { title: title.trim() });
      setRetro(updated);
      setTitle(updated.title);
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to update title', 'Cannot update title');
    }
  };

  const handleCloseRetro = async () => {
    const agreed = await showConfirm({
      title: 'Close Retrospective?',
      text: 'Close this retrospective? No more items can be added after closing.',
      confirmText: 'Close Retrospective',
      danger: true,
    });
    if (!agreed) return;
    try {
      const { value: summary } = await Swal.fire({
        title: 'Retrospective Summary',
        text: 'Optional summary of the retrospective (leave blank to skip):',
        input: 'textarea',
        inputPlaceholder: 'Summary...',
        inputValue: '',
        showCancelButton: true,
        confirmButtonText: 'Close Retrospective',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#3b82f6',
        background: '#0f172a',
        color: '#e2e8f0',
      });
      const updated = await updateRetrospective(retro.id, { status: 'closed', summary: summary || '' });
      setRetro(updated);
      setTitle(updated.title || '');
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to close retrospective', 'Cannot close retrospective');
    }
  };

  const handleReopenRetro = async () => {
    try {
      const updated = await updateRetrospective(retro.id, { status: 'open' });
      setRetro(updated);
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to reopen retrospective', 'Cannot reopen retrospective');
    }
  };

  const handleDeleteRetro = async () => {
    const confirmed = await showConfirm({
      title: 'Delete Retrospective?',
      text: 'Delete this retrospective and all its items? This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteRetrospective(retro.id);
      setRetro(null);
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to delete retrospective', 'Cannot delete retrospective');
    }
  };

  const renderColumn = (col) => {
    const accent = ACCENT_STYLES[col.accent];
    const items = retro?.items_grouped?.[col.key] || [];
    const isClosed = retro?.status === 'closed';

    return (
      <div key={col.key} className="card p-4 border border-slate-800/80 bg-slate-900/40 flex flex-col space-y-3">
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${accent.header}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={col.icon} />
          </svg>
          <span className="text-xs font-bold uppercase tracking-wider">{col.title}</span>
          <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${accent.badge}`}>
            {items.length}
          </span>
        </div>
        <p className="text-[10px] text-slate-500">{col.hint}</p>

        {canEdit && retro && !isClosed && (
          <div className="space-y-2">
            {col.key === 'action_item' && isAdmin && (
              <select
                value={draftOwners.action_item}
                onChange={(e) => setDraftOwners({ action_item: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">Assign owner…</option>
                {projectUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={drafts[col.key]}
                onChange={(e) => setDrafts(d => ({ ...d, [col.key]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAddItem(col.key)}
                placeholder={col.placeholder}
                className={`flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none ${accent.ring} placeholder:text-slate-600`}
                disabled={busy[col.key]}
              />
              <button
                onClick={() => handleAddItem(col.key)}
                disabled={busy[col.key] || !drafts[col.key]?.trim()}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 ${accent.button}`}
              >
                + Add
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {items.map(item => (
            <div
              key={item.id}
              className={`p-3 rounded-lg border text-xs transition-colors ${
                col.key === 'action_item' && item.is_done
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-slate-800 bg-slate-950/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`text-slate-200 leading-relaxed min-w-0 ${item.is_done ? 'line-through opacity-60' : ''}`}>
                  {item.content}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleVote(item)}
                    disabled={retro.status === 'closed'}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-blue-600/20 hover:text-blue-400 disabled:opacity-40 transition-colors"
                    title="Vote"
                  >
                    <span className="text-[10px]">👍</span>
                    <span className="text-[10px] font-bold tabular-nums">{item.votes}</span>
                  </button>
                  {canEdit && !isClosed && (isAdmin || item.created_by_id === user.id) && (
                    <button
                      onClick={() => handleDeleteItem(item)}
                      className="px-1.5 py-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {col.key === 'action_item' && (
                  <button
                    onClick={() => handleToggleDone(item)}
                    disabled={retro.status === 'closed'}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors disabled:opacity-40 ${
                      item.is_done
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-emerald-400'
                    }`}
                  >
                    {item.is_done ? '✓ Done' : '○ Open'}
                  </button>
                )}
                {col.key === 'action_item' && item.owner && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-semibold">
                    {item.owner.username}
                  </span>
                )}
                {item.created_by && (
                  <span className="text-[10px] text-slate-600">by {item.created_by.username}</span>
                )}
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="text-center py-8 text-slate-600 border border-dashed border-slate-800 rounded-lg">
              <p className="text-[10px]">No items yet — add the first one above.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-bold text-white leading-tight">Sprint Retrospective</h2>
          <p className="text-xs text-slate-500 mt-1">
            The closing Scrum ceremony — the team inspects the sprint and adapts for the next one.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400">Loading retrospective...</div>
      ) : sprints.length === 0 ? (
        <div className="card p-12 text-center text-slate-500 flex flex-col items-center justify-center border-dashed min-h-[250px]">
          <h3 className="text-base font-semibold text-white">No Sprints Yet</h3>
          <p className="text-xs text-slate-600 max-w-sm mt-1">
            A retrospective is run at the end of each sprint. Create and complete a sprint to hold one here.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4 flex-wrap">
            <span className="text-xs font-semibold text-slate-400">Sprint:</span>
            <select
              value={selectedSprintId}
              onChange={(e) => handleSprintChange(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer font-medium"
            >
              {sprints.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
              ))}
            </select>
            {selectedSprint && (
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                selectedSprint.status === 'completed'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : selectedSprint.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700/50'
              }`}>
                {selectedSprint.status}
              </span>
            )}
          </div>

          {!retro ? (
            <div className="card p-12 text-center text-slate-500 flex flex-col items-center justify-center border-dashed min-h-[260px]">
              <svg className="w-12 h-12 text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <h3 className="text-base font-semibold text-white">No Retrospective Yet</h3>
              <p className="text-xs text-slate-600 max-w-md mt-1 mb-6 leading-relaxed">
                Looks like Scrum — each sprint ends with a retrospective. The team reflects on what went
                well, what to improve, and commits to concrete action items for the next sprint.
              </p>
              {isAdmin ? (
                <button
                  onClick={handleOpenRetro}
                  disabled={busy.open}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-blue-600/15"
                >
                  {busy.open ? 'Opening...' : 'Open Retrospective'}
                </button>
              ) : (
                <p className="text-[11px] text-slate-600 italic">Ask your Scrum master to open the retrospective.</p>
              )}
            </div>
          ) : (
            <>
              {/* Retro Header */}
              <div className="card p-5 space-y-4 border border-slate-800/80 bg-slate-900/40">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="min-w-0 flex-1">
                    {isAdmin && retro.status === 'open' ? (
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={handleSaveTitle}
                        className="w-full bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 text-sm font-bold text-white focus:outline-none"
                        placeholder="Retrospective title"
                      />
                    ) : (
                      <h3 className="text-sm font-bold text-white">{retro.title}</h3>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        retro.status === 'open'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border-slate-700/50'
                      }`}>
                        {retro.status}
                      </span>
                      <span className="text-[10px] text-slate-500">· {retro.stats?.total_votes || 0} votes</span>
                      <span className="text-[10px] text-slate-500">· {retro.stats?.action_items_done || 0}/{retro.stats?.action_items || 0} action items done</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isAdmin && retro.status === 'open' && (
                      <button
                        onClick={handleCloseRetro}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-600/20 transition-all text-xs font-semibold"
                      >
                        Close Retrospective
                      </button>
                    )}
                    {isAdmin && retro.status === 'closed' && (
                      <button
                        onClick={handleReopenRetro}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all text-xs font-semibold"
                      >
                        Reopen
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={handleDeleteRetro}
                        className="px-3 py-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-900/30 transition-all text-xs font-semibold"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {retro.summary && (
                  <div className="rounded-lg bg-slate-950/60 border border-slate-800 px-4 py-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Summary</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{retro.summary}</p>
                  </div>
                )}
              </div>

              {/* Three-column board */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
                {COLUMNS.map(renderColumn)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default RetrospectivePage;