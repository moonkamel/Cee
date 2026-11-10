// Tableau de bord web (page client, inscription) : la production par défaut. Séparé de
// config.ts pour les écrans qui n'ont besoin que de lui.
export const webUrl = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://preuvio-web.vercel.app').replace(
  /\/$/,
  '',
);
