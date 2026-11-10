#!/usr/bin/env bash
# Prépare le compte Stripe de Preuvio (section 15, S18) : produits Solo et Équipe, 4 prix
# (mensuel, annuel avec deux mois offerts), TVA française 20 %, portail client, webhook.
# À lancer une fois par compte (test, puis production) ; relançable sans doublon de prix.
#
#   STRIPE_SECRET_KEY=sk_test_… SUPABASE_PROJECT_REF=gctdhvtvosqyehouxorn scripts/stripe-setup.sh
#
# Affiche à la fin les secrets à enregistrer dans les Edge Functions (Supabase → Edge Functions
# → Secrets) : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_TAX_RATE_ID, STRIPE_PORTAL_CONFIG.
set -euo pipefail
: "${STRIPE_SECRET_KEY:?STRIPE_SECRET_KEY manquante}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF manquant}"
API=https://api.stripe.com/v1
s() { curl -sS -u "$STRIPE_SECRET_KEY:" "$@"; }
field() { python3 -c "import json,sys; d=json.load(sys.stdin); print(eval('d'+sys.argv[1]))" "$1"; }

price_for() { # plan interval cents product
  local key="$1_$2"
  local found
  found=$(s "$API/prices?lookup_keys[]=$key&active=true" | field "['data'][0]['id'] if d['data'] else ''")
  if [ -n "$found" ]; then echo "$found"; return; fi
  s "$API/prices" -d product="$4" -d currency=eur -d unit_amount="$3" \
    -d "recurring[interval]=$2" -d tax_behavior=exclusive -d lookup_key="$key" | field "['id']"
}

product() { # nom (retrouvé par sa métadonnée s'il existe déjà)
  local found
  found=$(s -G "$API/products/search" --data-urlencode "query=metadata['preuvio']:'$1'" \
    | field "['data'][0]['id'] if d['data'] else ''")
  if [ -n "$found" ]; then echo "$found"; return; fi
  s "$API/products" -d name="Preuvio $1" -d "metadata[preuvio]=$1" | field "['id']"
}

SOLO=$(product Solo)
TEAM=$(product Équipe)
SOLO_M=$(price_for solo month 3900 "$SOLO")
SOLO_Y=$(price_for solo year 39000 "$SOLO")
TEAM_M=$(price_for team month 9900 "$TEAM")
TEAM_Y=$(price_for team year 99000 "$TEAM")
echo "Prix : $SOLO_M $SOLO_Y $TEAM_M $TEAM_Y"

TAX=$(s "$API/tax_rates" -d display_name=TVA -d percentage=20 -d inclusive=false \
  -d country=FR -d jurisdiction=FR -d description="TVA France 20 %" | field "['id']")

PORTAL=$(s "$API/billing_portal/configurations" \
  -d "business_profile[headline]=Preuvio : votre abonnement" \
  -d "features[invoice_history][enabled]=true" \
  -d "features[payment_method_update][enabled]=true" \
  -d "features[customer_update][enabled]=true" \
  -d "features[customer_update][allowed_updates][0]=address" \
  -d "features[customer_update][allowed_updates][1]=tax_id" \
  -d "features[subscription_cancel][enabled]=true" \
  -d "features[subscription_cancel][mode]=at_period_end" \
  -d "features[subscription_update][enabled]=true" \
  -d "features[subscription_update][default_allowed_updates][0]=price" \
  -d "features[subscription_update][products][0][product]=$SOLO" \
  -d "features[subscription_update][products][0][prices][0]=$SOLO_M" \
  -d "features[subscription_update][products][0][prices][1]=$SOLO_Y" \
  -d "features[subscription_update][products][1][product]=$TEAM" \
  -d "features[subscription_update][products][1][prices][0]=$TEAM_M" \
  -d "features[subscription_update][products][1][prices][1]=$TEAM_Y" | field "['id']")

HOOK=$(s "$API/webhook_endpoints" \
  -d url="https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/stripe-webhook" \
  -d "enabled_events[0]=customer.subscription.created" \
  -d "enabled_events[1]=customer.subscription.updated" \
  -d "enabled_events[2]=customer.subscription.deleted")
HOOK_SECRET=$(echo "$HOOK" | field "['secret']")

cat <<OUT

À enregistrer dans les secrets des Edge Functions :
  STRIPE_WEBHOOK_SECRET=$HOOK_SECRET
  STRIPE_TAX_RATE_ID=$TAX
  STRIPE_PORTAL_CONFIG=$PORTAL
  STRIPE_SECRET_KEY=(la clé utilisée pour ce script)
Moyens de paiement (carte, prélèvement SEPA) : Stripe → Paramètres → Moyens de paiement.
OUT
