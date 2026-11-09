import type { ColorScheme } from '@preuvio/ui-tokens';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '@/theme/theme';
import {
  BigButton,
  ChecklistRow,
  EmptyState,
  ProgressRing,
  ProofCard,
  ShutterButton,
  StatusPill,
  Toast,
  VoiceButton,
} from '..';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Heavy: 'heavy', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

const renderIn = (ui: ReactElement, scheme: ColorScheme = 'light') =>
  render(<ThemeProvider initialScheme={scheme}>{ui}</ThemeProvider>);

/** Style aplati d'un Pressable (qui accepte une fonction de style). */
function flatStyle(node: { props: { style?: unknown } }) {
  const s = node.props.style;
  return StyleSheet.flatten(typeof s === 'function' ? s({ pressed: false }) : s) ?? {};
}

beforeEach(() => jest.clearAllMocks());

describe('BigButton', () => {
  it('fait 64 px de haut, porte son libellé et vibre au tap', async () => {
    const onPress = jest.fn();
    await renderIn(<BigButton label="Commencer" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Commencer' });
    expect(flatStyle(button).minHeight).toBe(64);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it('utilise la couleur action du mode courant', async () => {
    await renderIn(<BigButton label="Commencer" onPress={jest.fn()} />, 'contrast');
    expect(flatStyle(screen.getByTestId('big-button')).backgroundColor).toBe('#FDBA74');
  });
});

describe('ShutterButton', () => {
  it('fait 88 px et déclenche un retour haptique fort', async () => {
    const onPress = jest.fn();
    await renderIn(<ShutterButton onPress={onPress} />);
    const shutter = screen.getByRole('button', { name: 'Prendre la photo' });
    expect(flatStyle(shutter).width).toBe(88);
    await fireEvent.press(shutter);
    expect(onPress).toHaveBeenCalled();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('heavy');
  });
});

describe('StatusPill', () => {
  it.each([
    ['ok', 'Validée'],
    ['warn', 'À reprendre'],
    ['ko', 'Manquante'],
  ] as const)(
    'le ton %s affiche toujours un mot (%s), jamais la couleur seule',
    async (tone, word) => {
      await renderIn(<StatusPill tone={tone} />);
      expect(screen.getByText(word)).toBeTruthy();
      expect(screen.getByLabelText(word)).toBeTruthy();
    },
  );
});

describe('ProofCard', () => {
  it('affiche la consigne et le statut', async () => {
    await renderIn(<ProofCard instruction="Plaque de l'unité extérieure" tone="warn" />);
    expect(screen.getByText("Plaque de l'unité extérieure")).toBeTruthy();
    expect(screen.getByText('À reprendre')).toBeTruthy();
  });
});

describe('ChecklistRow', () => {
  it("dépasse la cible tactile de 56 px et annonce l'action et l'état", async () => {
    const onPress = jest.fn();
    await renderIn(
      <ChecklistRow label="Unité extérieure" icon="camera" tone="ko" onPress={onPress} />,
    );
    const row = screen.getByRole('button', { name: 'Photographier : Unité extérieure. Manquante' });
    expect(flatStyle(row).minHeight).toBeGreaterThanOrEqual(56);
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalled();
  });
});

describe('VoiceButton', () => {
  it("démarre à l'appui long, s'arrête au relâchement, avec vibration aux deux bouts", async () => {
    const onStart = jest.fn();
    const onEnd = jest.fn();
    const { rerender } = await renderIn(
      <VoiceButton recording={false} onRecordStart={onStart} onRecordEnd={onEnd} />,
    );
    await fireEvent(screen.getByTestId('voice-button'), 'longPress');
    expect(onStart).toHaveBeenCalled();

    await rerender(
      <ThemeProvider initialScheme="light">
        <VoiceButton recording onRecordStart={onStart} onRecordEnd={onEnd} levels={[0.5, 0.8]} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('voice-wave')).toBeTruthy();
    await fireEvent(screen.getByTestId('voice-button'), 'pressOut');
    expect(onEnd).toHaveBeenCalled();
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
  });
});

describe('ProgressRing', () => {
  it('annonce « 7 sur 9 preuves »', async () => {
    await renderIn(<ProgressRing done={7} total={9} />);
    expect(screen.getByLabelText('7 sur 9 preuves')).toBeTruthy();
    expect(screen.getByText('7/9')).toBeTruthy();
  });
});

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('propose « Annuler » puis disparaît seul après 5 secondes', async () => {
    const onDismiss = jest.fn();
    const onUndo = jest.fn();
    await renderIn(
      <Toast visible message="Photo supprimée" onUndo={onUndo} onDismiss={onDismiss} />,
    );
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeTruthy();
    await act(() => jest.advanceTimersByTime(4999));
    expect(onDismiss).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('annule sur demande', async () => {
    const onUndo = jest.fn();
    await renderIn(
      <Toast visible message="Photo supprimée" onUndo={onUndo} onDismiss={jest.fn()} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));
    expect(onUndo).toHaveBeenCalled();
  });
});

describe('EmptyState', () => {
  it('ne propose qu’une seule action', async () => {
    await renderIn(
      <EmptyState
        icon="calendar"
        title="Aucun chantier"
        actionLabel="Nouveau chantier"
        onAction={jest.fn()}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
