import { render, screen } from '@testing-library/react';
import KanbanBoard from './KanbanBoard';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 2, role: 'developer' } }) }));
vi.mock('../services/api', () => ({ updateTaskStatus: vi.fn() }));

const task = (id, title, extra = {}) => ({
  id, title, status: 'Todo', priority: 3, category: 'Backend', estimated_hours: 2,
  assignees: [], assigned_to_id: null, ...extra,
});

it('shows a developer only the tasks assigned to them (regression ISSUE-005)', () => {
  render(<KanbanBoard tasks={[
    task(1, 'Mine', { assigned_to_id: 2 }),
    task(2, 'Also mine', { assignees: [{ id: 2, username: 'dev' }] }),
    task(3, 'Someone else', { assigned_to_id: 9 }),
  ]} />);
  expect(screen.getByText('Mine')).toBeInTheDocument();
  expect(screen.getByText('Also mine')).toBeInTheDocument();
  expect(screen.queryByText('Someone else')).not.toBeInTheDocument();
});
