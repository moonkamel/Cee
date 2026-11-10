import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

// Premier lancement du poseur (section 15, écran 3) : une indication sur le premier chantier,
// montrée une seule fois sur ce téléphone.
const KEY = 'preuvio.firstJobsiteHintSeen';

export function useFirstJobsiteHint(): { show: boolean; dismiss: () => void } {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let alive = true;
    SecureStore.getItemAsync(KEY)
      .then((seen) => alive && setShow(seen !== '1'))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const dismiss = useCallback(() => {
    setShow(false);
    void SecureStore.setItemAsync(KEY, '1').catch(() => undefined);
  }, []);
  return { show, dismiss };
}
