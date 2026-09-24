import { render, screen, waitFor } from '@testing-library/react';
import BurndownChart from './BurndownChart';

vi.mock('../services/api', () => ({
  fetchBurndown: vi.fn().mockResolvedValue([
    { date: '2026-09-23', ideal: 10, actual: 10 },
    { date: '2026-09-24', ideal: 5, actual: 8 },
  ]),
}));
vi.mock('recharts', () => {
  const box = (name) => ({ children }) => <div data-testid={name}>{children}</div>;
  return {
    ResponsiveContainer: box('ResponsiveContainer'), ComposedChart: box('ComposedChart'),
    Line: box('Line'), Area: box('Area'), XAxis: box('XAxis'), YAxis: box('YAxis'),
    CartesianGrid: box('CartesianGrid'), Tooltip: box('Tooltip'),
  };
});

it('renders ideal Line and actual Area inside a ComposedChart (regression ISSUE-004)', async () => {
  render(<BurndownChart sprintId={1} />);
  await waitFor(() => expect(screen.getByTestId('ComposedChart')).toBeInTheDocument());
  const chart = screen.getByTestId('ComposedChart');
  expect(chart.querySelector('[data-testid="Line"]')).not.toBeNull();
  expect(chart.querySelector('[data-testid="Area"]')).not.toBeNull();
});
