import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const fieldMask = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.googleMapsUri',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.photos',
  'places.primaryTypeDisplayName',
  'places.businessStatus',
].join(',');

function analysePlace(place: Record<string, unknown>) {
  const hasWebsite = Boolean(place.websiteUri);
  const rating = Number(place.rating || 0);
  const reviews = Number(place.userRatingCount || 0);
  const photos = Array.isArray(place.photos) ? place.photos.length : 0;
  let gaps = 0;
  if (!hasWebsite) gaps += 2;
  if (reviews < 10) gaps += 1;
  if (!rating || rating < 4) gaps += 1;
  if (photos < 5) gaps += 1;
  const healthScore = Math.max(10, 100 - gaps * 18);
  const opportunity = !hasWebsite
    ? 'Sem site: oportunidade de presença digital e captação local.'
    : gaps >= 2
      ? 'Perfil com sinais de baixa otimização no Google.'
      : 'Perfil consistente; oportunidade de melhoria e diferenciação local.';
  return {
    has_website: hasWebsite,
    rating,
    review_count: reviews,
    photo_count: photos,
    health_score: healthScore,
    opportunity,
  };
}

export async function GET() {
  return NextResponse.json({ configured: Boolean(process.env.GOOGLE_PLACES_API_KEY) });
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get('Authorization') || '';
  const accessToken = authorization.replace(/^Bearer\s+/i, '');
  if (!supabaseUrl || !publishableKey) return NextResponse.json({ error: 'Supabase não configurado no servidor.' }, { status: 500 });
  if (!accessToken) return NextResponse.json({ error: 'Sessão ausente.' }, { status: 401 });
  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: current } = await client.auth.getUser(accessToken);
  if (!current.user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  const { data: profile } = await client.from('profiles').select('role,permissions,is_active').eq('id', current.user.id).maybeSingle();
  const permissions = profile?.permissions || [];
  const canProspect = profile?.is_active && (
    ['admin', 'administrador'].includes((profile.role || '').toLowerCase())
    || permissions.includes('Prospecção')
    || permissions.includes('prospeccao')
  );
  if (!canProspect) return NextResponse.json({ error: 'Seu perfil não possui acesso à prospecção.' }, { status: 403 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY não configurada na Vercel.' }, { status: 500 });

  const body = await request.json();
  const category = String(body.category || '').trim();
  const city = String(body.city || '').trim();
  const maxResults = Math.min(Math.max(Number(body.maxResults) || 10, 1), 20);
  if (!category || !city) return NextResponse.json({ error: 'Informe o segmento e a cidade/região.' }, { status: 400 });

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': fieldMask },
    body: JSON.stringify({ textQuery: `${category} em ${city}`, languageCode: 'pt-BR', regionCode: 'BR', pageSize: maxResults }),
  });
  const data = await response.json();
  if (!response.ok) return NextResponse.json({ error: data?.error?.message || 'Não foi possível consultar o Google Places.' }, { status: response.status });

  const places = (data.places || [])
    .filter((place: Record<string, unknown>) => place.businessStatus !== 'CLOSED_PERMANENTLY')
    .map((place: Record<string, unknown>) => {
      const analysis = analysePlace(place);
      const type = place.primaryTypeDisplayName as { text?: string } | undefined;
      return {
        google_place_id: place.id || null,
        company_name: (place.displayName as { text?: string } | undefined)?.text || 'Empresa sem nome',
        category: type?.text || category,
        city,
        address: place.formattedAddress || null,
        phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
        whatsapp: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
        google_maps_url: place.googleMapsUri || null,
        website_url: place.websiteUri || null,
        ...analysis,
      };
    });

  return NextResponse.json({ places });
}
