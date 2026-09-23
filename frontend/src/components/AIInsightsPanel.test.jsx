import { render, screen } from '@testing-library/react';
import AIInsightsPanel from './AIInsightsPanel';

vi.mock('../services/api', () => ({ fetchTaskActivity: vi.fn(), createTask: vi.fn() }));

const base = { id: 1, confidence_score: 0.9, risk_flags: '[]', suggested_subtasks: '[]', ai_rationale: 'r' };

it('shows model and provider for an AI result', () => {
  render(<AIInsightsPanel task={{ ...base, ai_provider: 'ollama', ai_model: 'qwen3:14b', ai_is_fallback: false }} />);
  expect(screen.getByTestId('ai-provenance')).toHaveTextContent('qwen3:14b via ollama');
});

it('shows a fallback badge when AI was unavailable', () => {
  render(<AIInsightsPanel task={{ ...base, confidence_score: 0.3, ai_provider: 'fallback', ai_model: null, ai_is_fallback: true, ai_needs_review: true }} />);
  expect(screen.getByText('Keyword fallback — AI was unavailable')).toBeInTheDocument();
  expect(screen.getByText('Needs review')).toBeInTheDocument();
});

it('shows no provenance for tasks analysed before tracking existed', () => {
  render(<AIInsightsPanel task={base} />);
  expect(screen.queryByTestId('ai-provenance')).not.toBeInTheDocument();
});
