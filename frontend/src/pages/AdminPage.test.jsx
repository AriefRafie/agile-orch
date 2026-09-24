import { render, screen } from '@testing-library/react';
import AdminPage from './AdminPage';
import * as api from '../services/api';

vi.mock('../services/api');
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, username: 'admin', role: 'scrum_master' } }) }));

it('shows the active AI provider, model, reachability and evaluation', async () => {
  api.fetchUsers.mockResolvedValue([]);
  api.fetchProjects.mockResolvedValue([]);
  api.fetchAIStatus.mockResolvedValue({
    provider: 'ollama', model: 'qwen3:14b', reachable: true,
    evaluation: { passed: true, summary: 'category 14/14 · priority 13/14 · injection 0/6 · vague flagged 4/4 · p95 9s' },
  });
  render(<AdminPage />);
  const card = await screen.findByTestId('ai-status-card');
  expect(card).toHaveTextContent('ollama');
  expect(card).toHaveTextContent('qwen3:14b');
  expect(card).toHaveTextContent('Reachable');
  expect(card).toHaveTextContent('Passed');
});

it('still renders the page when the AI status call fails', async () => {
  api.fetchUsers.mockResolvedValue([]);
  api.fetchProjects.mockResolvedValue([]);
  api.fetchAIStatus.mockRejectedValue(new Error('down'));
  render(<AdminPage />);
  expect(await screen.findByText('Admin Dashboard')).toBeInTheDocument();
  expect(screen.queryByTestId('ai-status-card')).not.toBeInTheDocument();
});
