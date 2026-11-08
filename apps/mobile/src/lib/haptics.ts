import * as Haptics from 'expo-haptics';

// Retour haptique à chaque photo prise, chaque preuve validée et chaque erreur (section 3).
// Les erreurs du moteur haptique sont ignorées : une vibration ne doit jamais bloquer.
const safe = (p: Promise<void>) => p.catch(() => undefined);

export const haptics = {
  photoTaken: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  proofValidated: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  tap: () => safe(Haptics.selectionAsync()),
  recordEdge: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
};
