import { useSearchParams } from 'react-router-dom';
import { recentRange, rangeError } from './analyticsPresentation';

export function useStaffPeriod(defaultDays = 30) {
  const [params, setParams] = useSearchParams();
  const legacyDays = Number(params.get('days'));
  const defaults = recentRange([7, 30, 90].includes(legacyDays) ? legacyDays : defaultDays);
  const range = { from: params.get('from') ?? defaults.from, to: params.get('to') ?? defaults.to };
  return { range, invalid: rangeError(range), change: next => setParams(next) };
}
