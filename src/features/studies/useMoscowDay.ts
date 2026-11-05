import { useEffect, useState } from 'react';
import { moscowDay } from './dates.ts';

export function useMoscowDay() {
  const [day, setDay] = useState(moscowDay);
  useEffect(() => {
    const refresh = () => setDay(moscowDay());
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    refresh();
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return day;
}
