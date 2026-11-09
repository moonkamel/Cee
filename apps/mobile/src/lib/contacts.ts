import { Contact } from 'expo-contacts';

export type PickedContact = { fullName: string; phone: string | null };

/**
 * Sélecteur de contacts du téléphone (autorisation demandée par le système au moment
 * où il sert, avec la phrase d'app.json). Annulation ou refus : null, jamais d'erreur.
 */
export async function pickContact(): Promise<PickedContact | null> {
  try {
    const contact = await Contact.presentPicker();
    if (!contact) return null;
    const fullName = (await contact.getFullName()).trim();
    const phones = await contact.getPhones();
    const mobile = phones.find((p) => /^(\+33|0)[67]/.test((p.number ?? '').replace(/\s/g, '')));
    return fullName ? { fullName, phone: (mobile ?? phones[0])?.number ?? null } : null;
  } catch {
    return null;
  }
}
