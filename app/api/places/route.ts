import { NextRequest, NextResponse } from 'next/server';

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
  return { hasWebsite, rating, reviews, photos, healthScore, opportunity };
}

export async function POST(request: NextRequest) {
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
    body: JSON.stringify({ textQuery: `${category} em ${city}`, languageCode: 'pt-BR', regionCode: 'BR', maxResultCount: maxResults }),
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
