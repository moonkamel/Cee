import {
  shapeFromDrag,
  toRelative,
  type Annotation,
  type AnnotationTool,
  type Point,
} from '@preuvio/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { AnnotationLayer } from '@/components/AnnotationLayer';
import { BigInput } from '@/components/BigInput';
import { Screen } from '@/components/Screen';
import { AppText, BigButton, Toast } from '@/components/ui';
import { VoiceNoteButton } from '@/components/VoiceNoteButton';
import { useData } from '@/data/data-context';
import type { PhotoDetail } from '@/data/types';
import { t } from '@/i18n/fr';
import { useTheme } from '@/theme/theme';

const TOOLS: AnnotationTool[] = ['arrow', 'circle', 'rect', 'text'];

// Photo en grand (section 9) : annotations flèche, cercle, rectangle et texte sur un calque
// séparé, note vocale rattachée à la photo. L'original n'est jamais modifié.
export default function PhotoScreen() {
  const { id, photoId } = useLocalSearchParams<{ id: string; photoId: string }>();
  const data = useData();
  const { colors, spacing, radius, sizes } = useTheme();
  const [photo, setPhoto] = useState<PhotoDetail | null | undefined>(undefined);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [tool, setTool] = useState<AnnotationTool>('arrow');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [ratio, setRatio] = useState(4 / 3);
  const [start, setStart] = useState<Point | null>(null);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [textAt, setTextAt] = useState<Point | null>(null);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void data.getPhoto(photoId).then((p) => {
      setPhoto(p);
      setAnnotations(p?.annotations ?? []);
    });
  }, [data, photoId]);

  const at = (e: { nativeEvent: { locationX: number; locationY: number } }) =>
    toRelative({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }, size);

  if (photo === null) {
    return (
      <Screen>
        <AppText>{t('photo.missing')}</AppText>
        <BigButton
          variant="secondary"
          icon="arrow-left"
          label={t('jobsite.back')}
          onPress={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <BigButton
        variant="secondary"
        icon="arrow-left"
        label={t('jobsite.back')}
        onPress={() => router.back()}
      />

      <View
        testID="photo-canvas"
        onLayout={(e) =>
          setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.width / ratio })
        }
        style={{
          width: '100%',
          aspectRatio: ratio,
          borderRadius: radius.md,
          overflow: 'hidden',
          backgroundColor: colors.border,
        }}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          if (tool === 'text') return;
          setStart(at(e));
        }}
        onResponderMove={(e) => {
          if (!start || tool === 'text') return;
          setDraft(shapeFromDrag(tool, start, at(e)));
        }}
        onResponderRelease={(e) => {
          if (tool === 'text') {
            setTextAt(at(e));
            return;
          }
          const shape = start ? shapeFromDrag(tool, start, at(e)) : null;
          if (shape) setAnnotations((a) => [...a, shape]);
          setStart(null);
          setDraft(null);
        }}
      >
        {photo?.uri ? (
          <Image
            source={{ uri: photo.uri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="contain"
            onLoad={(e) => {
              const { width, height } = e.nativeEvent.source;
              if (width && height) setRatio(width / height);
            }}
          />
        ) : null}
        {size.width > 0 ? (
          <AnnotationLayer
            annotations={draft ? [...annotations, draft] : annotations}
            width={size.width}
            height={size.height}
          />
        ) : null}
      </View>
      <AppText variant="caption" color="text-muted">
        {t('photo.original')}
      </AppText>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {TOOLS.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityLabel={t(`photo.${k}`)}
            accessibilityState={{ selected: tool === k }}
            onPress={() => setTool(k)}
            style={{
              minHeight: sizes.touchMin,
              minWidth: sizes.touchMin * 1.6,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              borderWidth: 2,
              borderColor: colors.brand,
              backgroundColor: tool === k ? colors.brand : colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText variant="button" color={tool === k ? 'on-action' : 'brand'}>
              {t(`photo.${k}`)}
            </AppText>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('photo.undo')}
          disabled={annotations.length === 0}
          onPress={() => setAnnotations((a) => a.slice(0, -1))}
          style={{
            minHeight: sizes.touchMin,
            paddingHorizontal: spacing.md,
            justifyContent: 'center',
            opacity: annotations.length === 0 ? 0.4 : 1,
          }}
        >
          <AppText variant="button" color="brand">
            {t('photo.undo')}
          </AppText>
        </Pressable>
      </View>

      {textAt ? (
        <View style={{ gap: spacing.sm }}>
          <BigInput
            accessibilityLabel={t('photo.textPrompt')}
            placeholder={t('photo.textPrompt')}
            value={text}
            onChangeText={setText}
            autoFocus
            style={{ fontSize: 20, letterSpacing: 0 }}
          />
          <BigButton
            variant="secondary"
            label={t('photo.textAdd')}
            disabled={text.trim() === ''}
            onPress={() => {
              setAnnotations((a) => [...a, { type: 'text', at: textAt, text: text.trim() }]);
              setText('');
              setTextAt(null);
            }}
          />
        </View>
      ) : null}

      <BigButton
        icon="content-save-outline"
        label={t('photo.save')}
        onPress={() => void data.saveAnnotations(photoId, annotations).then(() => setSaved(true))}
      />
      <VoiceNoteButton jobsiteId={id} photoId={photoId} />
      <Toast visible={saved} message={t('photo.saved')} onDismiss={() => setSaved(false)} />
    </Screen>
  );
}
