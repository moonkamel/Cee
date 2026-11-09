import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText, Toast, VoiceButton } from '@/components/ui';
import { useData } from '@/data/data-context';
import { t } from '@/i18n/fr';
import { useVoiceRecorder } from '@/lib/voice';

/** Note dictée (section 9) : appui long, relâcher pour finir ; rangée hors ligne puis transcrite. */
export function VoiceNoteButton({
  jobsiteId,
  photoId = null,
}: {
  jobsiteId: string;
  photoId?: string | null;
}) {
  const data = useData();
  const [saved, setSaved] = useState(false);
  const voice = useVoiceRecorder((note) => {
    void data
      .recordVoiceNote({ ...note, jobsiteId, photoId })
      .then(() => setSaved(true))
      .catch(() => undefined);
  }, randomUUID);

  return (
    <View>
      <VoiceButton
        recording={voice.recording}
        levels={voice.levels}
        onRecordStart={() => void voice.start()}
        onRecordEnd={() => void voice.stop()}
      />
      {voice.denied ? <AppText color="ko">{t('voice.denied')}</AppText> : null}
      <Toast visible={saved} message={t('voice.saved')} onDismiss={() => setSaved(false)} />
    </View>
  );
}
