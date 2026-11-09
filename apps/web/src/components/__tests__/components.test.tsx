import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatePill } from '../StatePill';
import { Tiles } from '../Tiles';
import { TodoList } from '../TodoList';

vi.mock('@/app/actions', () => ({
  markItemDone: vi.fn(),
  validateWaiver: vi.fn(),
  decide: vi.fn(),
}));

afterEach(cleanup);

describe('état d’un chantier', () => {
  it('toujours un mot avec la couleur', () => {
    render(<StatePill state="at_risk" />);
    expect(screen.getByText('À risque')).toBeTruthy();
    render(<StatePill state="complete" />);
    expect(screen.getByText('Complet')).toBeTruthy();
  });
});

describe('quatre tuiles', () => {
  it('chacune ouvre la liste filtrée', () => {
    render(<Tiles tiles={{ inProgress: 4, atRisk: 1, orange: 2, batchesNear: 0 }} />);
    expect(screen.getByRole('link', { name: /4\s*Chantiers en cours/ }).getAttribute('href')).toBe(
      '/chantiers?filtre=en-cours',
    );
    expect(screen.getByRole('link', { name: /1\s*Chantiers à risque/ }).getAttribute('href')).toBe(
      '/chantiers?filtre=a-risque',
    );
    expect(screen.getByRole('link', { name: /2\s*Photos à trancher/ }).getAttribute('href')).toBe(
      '/chantiers?filtre=photos-orange',
    );
    expect(screen.getByRole('link', { name: /0\s*Lots près du seuil/ }).getAttribute('href')).toBe(
      '/lots',
    );
  });
});

describe('liste « À traiter »', () => {
  const items = [
    {
      kind: 'orange_photo' as const,
      id: 's1',
      jobsiteId: 'j1',
      jobsiteLabel: '8 allée des Tilleuls, Bron',
      title: 'Plaque',
      detail: 'Plaque illisible',
      since: '',
      keptByInstaller: true,
    },
    {
      kind: 'waiver' as const,
      id: 's2',
      jobsiteId: 'j1',
      jobsiteLabel: 'Bron',
      title: 'Trappe',
      detail: 'inaccessible',
      since: '',
    },
    {
      kind: 'material' as const,
      id: 'n1',
      jobsiteId: 'j1',
      jobsiteLabel: 'Bron',
      title: '2 coudes',
      detail: null,
      since: '',
    },
  ];

  it('action directe sur chaque ligne pour qui peut trancher', () => {
    render(<TodoList items={items} canDecide />);
    expect(screen.getByRole('link', { name: 'Trancher' }).getAttribute('href')).toBe('/preuves/s1');
    expect(screen.getByText(/gardée par le poseur/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Valider la dispense' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Commandé' })).toBeTruthy();
  });

  it('sans droit de trancher : la liste, sans les actions', () => {
    render(<TodoList items={items} canDecide={false} />);
    expect(screen.queryByRole('link', { name: 'Trancher' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Valider la dispense' })).toBeNull();
  });

  it('vide : un message clair', () => {
    render(<TodoList items={[]} canDecide />);
    expect(screen.getByText('Rien à traiter pour le moment.')).toBeTruthy();
  });
});
