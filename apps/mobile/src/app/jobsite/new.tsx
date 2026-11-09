import {
  WORK_TYPES,
  pendingAddressLabel,
  type AddressSuggestion,
  type WorkType,
} from '@preuvio/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { BigInput } from '@/components/BigInput';
import { Screen } from '@/components/Screen';
import { AppText, BigButton, Icon, type IconName } from '@/components/ui';
import { useData } from '@/data/data-context';
import type { NewJobsite } from '@/data/types';
import { t } from '@/i18n/fr';
import { pickContact } from '@/lib/contacts';
import { addressesNear, searchAddresses } from '@/lib/geocoding';
import { haptics } from '@/lib/haptics';
import { useCurrentPosition } from '@/lib/position';
import { useTheme } from '@/theme/theme';

// Création rapide d'un chantier sur le terrain, en 3 étapes et sans clavier (section 6) :
// adresse proposée par le GPS, travaux en tuiles, client pris dans les contacts.

const WORK_ICONS: Record<WorkType, IconName> = {
  pac_air_eau: 'heat-pump-outline',
  combles: 'home-roof',
  murs: 'wall',
  vmc: 'fan',
  biomasse: 'fire',
  menuiseries: 'window-closed-variant',
  photovoltaique: 'solar-panel',
};

type Address = NewJobsite['address'];

export default function NewJobsiteScreen() {
  const data = useData();
  const { spacing } = useTheme();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [address, setAddress] = useState<Address | null>(null);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [client, setClient] = useState<NewJobsite['client']>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function create() {
    if (!address) return;
    setCreating(true);
    setError(null);
    try {
      const id = await data.createJobsite({ address, workTypes, client });
      void haptics.proofValidated();
      router.replace({ pathname: '/jobsite/[id]', params: { id } });
    } catch {
      void haptics.error();
      setError(t('new.error'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Screen>
      <BigButton
        variant="secondary"
        icon="arrow-left"
        label={step === 1 ? t('new.cancel') : t('new.back')}
        onPress={() => (step === 1 ? router.back() : setStep((s) => (s - 1) as 1 | 2))}
      />
      <View style={{ gap: spacing.xs }}>
        <AppText variant="caption" color="text-muted">
          {t('new.step', { step })}
        </AppText>
        <AppText variant="title" accessibilityRole="header">
          {step === 1
            ? t('new.address.title')
            : step === 2
              ? t('new.work.title')
              : t('new.client.title')}
        </AppText>
      </View>

      {step === 1 ? (
        <AddressStep
          onPick={(a) => {
            setAddress(a);
            setStep(2);
          }}
        />
      ) : null}

      {step === 2 ? (
        <>
          <View
            accessibilityRole="list"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
          >
            {WORK_TYPES.map((w) => (
              <WorkTile
                key={w}
                type={w}
                selected={workTypes.includes(w)}
                onToggle={() =>
                  setWorkTypes((list) =>
                    list.includes(w) ? list.filter((x) => x !== w) : [...list, w],
                  )
                }
              />
            ))}
          </View>
          <BigButton
            label={t('new.work.continue')}
            disabled={workTypes.length === 0}
            onPress={() => setStep(3)}
          />
        </>
      ) : null}

      {step === 3 ? (
        <>
          <ClientStep client={client} onChange={setClient} />
          {error ? (
            <AppText color="ko" accessibilityLiveRegion="polite">
              {error}
            </AppText>
          ) : null}
          <BigButton
            icon="check"
            label={t('new.create')}
            disabled={creating}
            onPress={() => void create()}
          />
        </>
      ) : null}
    </Screen>
  );
}

function SuggestionRow({
  label,
  hint,
  onPress,
}: {
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  const { colors, spacing, radius, sizes } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: sizes.touchMin + spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: colors.brand,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon name="map-marker-outline" color="brand" />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText>{label}</AppText>
        {hint ? (
          <AppText variant="caption" color="text-muted">
            {hint}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

function AddressStep({ onPick }: { onPick: (a: Address) => void }) {
  const { spacing } = useTheme();
  const position = useCurrentPosition();
  const [nearby, setNearby] = useState<AddressSuggestion[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 8_000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!position) return;
    addressesNear(position.lat, position.lng).then(
      (list) => setNearby(list),
      () => setOffline(true),
    );
  }, [position]);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      searchAddresses(query, position ?? undefined).then(
        (list) => alive && setResults(list),
        () => alive && setResults([]),
      );
    }, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, position]);

  const pick = (s: AddressSuggestion) =>
    onPick({ label: s.label, banId: s.banId, lat: s.lat, lng: s.lng, pending: false });

  return (
    <View style={{ gap: spacing.md }}>
      {!position && !waited ? (
        <AppText color="text-muted">{t('new.address.locating')}</AppText>
      ) : null}
      {!position && waited ? (
        <AppText color="text-muted">{t('new.address.noPosition')}</AppText>
      ) : null}

      {nearby?.map((s, i) => (
        <SuggestionRow
          key={`${s.label}-${i}`}
          label={s.label}
          hint={i === 0 ? t('new.address.nearest') : undefined}
          onPress={() => pick(s)}
        />
      ))}

      {position && offline ? (
        <SuggestionRow
          label={t('new.address.keepPosition')}
          hint={t('new.address.keepPositionHint')}
          onPress={() =>
            onPick({
              label: pendingAddressLabel(position.lat, position.lng),
              banId: null,
              lat: position.lat,
              lng: position.lng,
              pending: true,
            })
          }
        />
      ) : null}

      <BigInput
        accessibilityLabel={t('new.address.search')}
        placeholder={t('new.address.search')}
        value={query}
        onChangeText={setQuery}
        style={{ fontSize: 20, letterSpacing: 0 }}
      />
      <AppText variant="caption" color="text-muted">
        {t('new.address.searchHint')}
      </AppText>
      {results.map((s, i) => (
        <SuggestionRow key={`r-${s.label}-${i}`} label={s.label} onPress={() => pick(s)} />
      ))}
    </View>
  );
}

function WorkTile({
  type,
  selected,
  onToggle,
}: {
  type: WorkType;
  selected: boolean;
  onToggle: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={t(`work.${type}`)}
      onPress={() => {
        void haptics.tap();
        onToggle();
      }}
      style={{
        width: '48%',
        minHeight: 112,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: selected ? 3 : 1,
        borderColor: selected ? colors.action : colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Icon name={WORK_ICONS[type]} color={selected ? 'action' : 'brand'} size={40} />
      <AppText variant="caption" style={{ textAlign: 'center' }}>
        {t(`work.${type}`)}
      </AppText>
      {selected ? (
        <View style={{ position: 'absolute', top: spacing.sm, right: spacing.sm }}>
          <Icon name="check-circle" color="action" size={24} />
        </View>
      ) : null}
    </Pressable>
  );
}

function ClientStep({
  client,
  onChange,
}: {
  client: NewJobsite['client'];
  onChange: (c: NewJobsite['client']) => void;
}) {
  const { spacing } = useTheme();
  const [manual, setManual] = useState(false);

  if (client && !manual) {
    return (
      <View style={{ gap: spacing.md }}>
        <AppText variant="button">{client.fullName}</AppText>
        {client.phone ? <AppText color="text-muted">{client.phone}</AppText> : null}
        <BigButton
          variant="secondary"
          label={t('new.client.change')}
          onPress={() => onChange(null)}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      {!manual ? (
        <>
          <BigButton
            variant="secondary"
            icon="account-box-outline"
            label={t('new.client.contacts')}
            onPress={() => void pickContact().then((c) => c && onChange(c))}
          />
          <BigButton
            variant="secondary"
            icon="pencil-outline"
            label={t('new.client.manual')}
            onPress={() => setManual(true)}
          />
          <AppText variant="caption" color="text-muted">
            {t('new.client.later')}
          </AppText>
        </>
      ) : (
        <>
          <BigInput
            accessibilityLabel={t('new.client.name')}
            placeholder={t('new.client.name')}
            value={client?.fullName ?? ''}
            onChangeText={(fullName) => onChange({ fullName, phone: client?.phone ?? null })}
            style={{ fontSize: 20, letterSpacing: 0 }}
          />
          <BigInput
            accessibilityLabel={t('new.client.phone')}
            placeholder={t('new.client.phone')}
            keyboardType="phone-pad"
            value={client?.phone ?? ''}
            onChangeText={(phone) => onChange({ fullName: client?.fullName ?? '', phone })}
            style={{ fontSize: 20, letterSpacing: 0 }}
          />
        </>
      )}
    </View>
  );
}
