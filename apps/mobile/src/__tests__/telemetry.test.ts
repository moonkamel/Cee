import {
  perfSummary,
  recordPerf,
  recentSamples,
  track,
  trackOnce,
  flushEvents,
} from '@/lib/telemetry';

describe('mesures de performance', () => {
  it('médiane, pire valeur et comparaison à la cible', () => {
    recordPerf('local_check', 120);
    recordPerf('local_check', 250);
    recordPerf('local_check', 400);
    const local = perfSummary(recentSamples()).find((r) => r.metric === 'local_check')!;
    expect(local).toEqual({
      metric: 'local_check',
      target: 300,
      count: 3,
      median: 250,
      worst: 400,
      ok: true,
    });
    const cold = perfSummary([]).find((r) => r.metric === 'cold_start_to_camera')!;
    expect(cold).toMatchObject({ count: 0, median: null, ok: null });
    expect(perfSummary([{ metric: 'shutter_to_saved', ms: 1500, at: '' }])[1]).toMatchObject({
      ok: false,
    });
  });

  it('sans clé PostHog, les événements ne partent pas et ne s’accumulent pas', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    track('app_open');
    trackOnce('jobsite:1', 'jobsite_started');
    trackOnce('jobsite:1', 'jobsite_started');
    await flushEvents();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
