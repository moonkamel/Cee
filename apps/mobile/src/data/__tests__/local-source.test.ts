import { assembleJobsites } from '../local-source';

describe('assembleJobsites', () => {
  it('assemble client, opérations, preuves, travaux et adresse en attente', () => {
    const [j] = assembleJobsites({
      jobsites: [
        {
          id: 'j1',
          address: 'Position GPS',
          status: 'in_progress',
          planned_start: '2026-11-09',
          planned_end: null,
          lat: 45.7,
          lng: 4.9,
          geofence_radius_m: 150,
          client_id: 'c1',
          work_types: ['pac_air_eau'],
          _addressPending: true,
        },
      ],
      clients: [{ id: 'c1', full_name: 'M. Martin' }],
      operations: [{ id: 'o1', jobsite_id: 'j1', label: 'PAC air/eau' }],
      slots: [
        { jobsite_id: 'j1', status: 'captured', required: true },
        { jobsite_id: 'autre', status: 'missing', required: true },
      ],
    });
    expect(j).toMatchObject({
      id: 'j1',
      clientName: 'M. Martin',
      operations: ['PAC air/eau'],
      workTypes: ['pac_air_eau'],
      proofs: [{ status: 'captured', required: true }],
      addressPending: true,
    });
  });

  it('écarte les chantiers terminés et trie par date', () => {
    const list = assembleJobsites({
      jobsites: [
        { id: 'b', address: 'B', status: 'planned', planned_start: '2026-11-10' },
        { id: 'a', address: 'A', status: 'planned', planned_start: '2026-11-09' },
        { id: 'c', address: 'C', status: 'completed_by_installer', planned_start: '2026-11-08' },
      ],
      clients: [],
      operations: [],
      slots: [],
    });
    expect(list.map((j) => j.id)).toEqual(['a', 'b']);
  });
});
