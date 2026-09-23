import { timeAgo } from './timeAgo';

const now = new Date('2026-09-23T12:00:00Z');
it.each([
  ['2026-09-23T11:59:40', 'just now'],
  ['2026-09-23T11:58:00', '2 min ago'],
  ['2026-09-23T09:00:00', '3 h ago'],
  ['2026-09-21T12:00:00', '2 d ago'],
])('%s -> %s (naive timestamps are UTC)', (iso, expected) => {
  expect(timeAgo(iso, now)).toBe(expected);
});
