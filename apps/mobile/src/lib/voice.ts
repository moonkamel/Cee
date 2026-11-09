import { MAX_VOICE_SECONDS } from '@preuvio/shared';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';

// Enregistrement d'une note vocale (section 9) : appui long pour parler, relâcher pour finir,
// arrêt automatique à 2 minutes. L'audio est rangé dans l'appli, hors ligne.

export type RecordedNote = { id: string; localUri: string; durationS: number };

function voiceDirectory(): Directory {
  const dir = new Directory(Paths.document, 'voice');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Niveau sonore (dB, -160 à 0) → 0 à 1, pour l'onde du bouton. */
export function meteringToLevel(db: number | undefined): number {
  if (db === undefined || !Number.isFinite(db)) return 0;
  return Math.min(1, Math.max(0, (db + 60) / 60));
}

export function useVoiceRecorder(onRecorded: (note: RecordedNote) => void, newId: () => string) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 150);
  const [levels, setLevels] = useState<number[]>([]);
  const [denied, setDenied] = useState(false);
  const active = useRef(false);
  const stopRef = useRef<() => Promise<void>>(async () => undefined);

  async function start() {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setDenied(true);
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    active.current = true;
    setLevels([]);
  }

  async function stop() {
    if (!active.current) return;
    active.current = false;
    const durationS = recorder.getStatus().durationMillis / 1000;
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri || durationS < 0.5) return; // appui trop court : rien à garder
    const id = newId();
    const file = new File(uri.startsWith('file://') ? uri : `file://${uri}`);
    const target = new File(voiceDirectory(), `${id}.m4a`);
    file.move(target);
    onRecorded({ id, localUri: target.uri, durationS: Math.min(durationS, MAX_VOICE_SECONDS) });
  }

  useEffect(() => {
    stopRef.current = stop;
  });

  // Onde sonore et arrêt automatique à la durée maximale, relevés pendant l'enregistrement.
  useEffect(() => {
    if (!state.isRecording) return;
    const timer = setInterval(() => {
      const status = recorder.getStatus();
      setLevels((l) => [...l.slice(-23), meteringToLevel(status.metering)]);
      if (status.durationMillis >= MAX_VOICE_SECONDS * 1000) void stopRef.current();
    }, 150);
    return () => clearInterval(timer);
  }, [state.isRecording, recorder]);

  return { recording: state.isRecording, levels, denied, start, stop };
}
