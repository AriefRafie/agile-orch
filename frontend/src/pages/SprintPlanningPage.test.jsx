import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SprintPlanningPage from './SprintPlanningPage';
import * as api from '../services/api';

vi.mock('../services/api');
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, role: 'scrum_master' } }) }));

it('shows an error and does not call the API when end date is before start date (regression ISSUE-002)', async () => {
  api.fetchSprints.mockResolvedValue([]);
  api.fetchTasks.mockResolvedValue([]);
  render(
    <MemoryRouter initialEntries={['/projects/1/planning']}>
      <Routes><Route path="/projects/:projectId/planning" element={<SprintPlanningPage />} /></Routes>
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByText('+ Create Sprint'));
  fireEvent.change(screen.getByPlaceholderText('e.g. Sprint 1 - Core API'), { target: { value: 'S1' } });
  const [start, end] = document.querySelectorAll('input[type="date"]');
  fireEvent.change(start, { target: { value: '2026-09-30' } });
  fireEvent.change(end, { target: { value: '2026-09-23' } });
  fireEvent.submit(start.closest('form'));
  expect(await screen.findByText('End date must be on or after the start date.')).toBeInTheDocument();
  expect(api.createSprint).not.toHaveBeenCalled();
});
