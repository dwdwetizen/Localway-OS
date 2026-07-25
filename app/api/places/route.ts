import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type PlaceRecord = Record<string, unknown>;
type AnalysisRecommendation = {
  title: string;
  detail: string;
  priority: 'alta' | 'media' | 'baixa';
};

const searchFieldMask = [
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
  'places.location',
  'places.regularOpeningHours',
  'places.primaryTypeDisplayName',
  'places.businessStatus',
].join(',');

const detailFieldMask = searchFieldMask
  .split(',')
  .map(field => field.replace(/^places\./, ''))
  .join(',');

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function readText(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function readDisplayName(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  return readText((value as Record<string, unknown>).text);
}

function readLocation(value: unknown) {
  if (!value || typeof value !== 'object') return { latitude: null, longitude: null };
  const location = value as Record<string, unknown>;
  const latitude = typeof location.latitude === 'number' ? location.latitude : null;
  const longitude = typeof location.longitude === 'number' ? location.longitude : null;
  return { latitude, longitude };
}

function openingHoursCount(value: unknown) {
  if (!value || typeof value !== 'object') return 0;
  const descriptions = (value as Record<string, unknown>).weekdayDescriptions;
  return Array.isArray(descriptions) ? descriptions.length : 0;
}

function analysePlace(place: PlaceRecord) {
  const hasWebsite = Boolean(place.websiteUri);
  const hasPhone = Boolean(place.nationalPhoneNumber || place.internationalPhoneNumber);
  const hasAddress = Boolean(place.formattedAddress);
  const rating = Number(place.rating || 0);
  const reviews = Number(place.userRatingCount || 0);
  const photos = Array.isArray(place.photos) ? place.photos.length : 0;
  const hoursCount = openingHoursCount(place.regularOpeningHours);
  const isOperational = place.businessStatus === 'OPERATIONAL';

  const reputation = clamp((rating / 5) * 70 + Math.min(reviews / 100, 1) * 30);
  const visibility = clamp(Math.min(reviews / 100, 1) * 65 + Math.min(photos / 10, 1) * 35);
  const completeness = clamp(
    [hasWebsite, hasPhone, hasAddress, hoursCount > 0, isOperational].filter(Boolean).length * 20,
  );
  const conversion = clamp(
    (hasWebsite ? 30 : 0)
      + (hasPhone ? 25 : 0)
      + (rating >= 4.3 ? 25 : rating >= 4 ? 15 : 0)
      + (reviews >= 30 ? 20 : reviews >= 10 ? 10 : 0),
  );
  const healthScore = clamp(
    reputation * 0.35 + visibility * 0.25 + completeness * 0.25 + conversion * 0.15,
  );

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: AnalysisRecommendation[] = [];

  if (rating >= 4.3) strengths.push(`Boa reputação: nota ${rating.toFixed(1)} no Google.`);
  else {
    weaknesses.push(rating ? `Nota atual de ${rating.toFixed(1)} pode reduzir conversões.` : 'Perfil sem nota pública disponível.');
    recommendations.push({
      title: 'Fortalecer a reputação',
      detail: 'Criar uma rotina de solicitação e acompanhamento de avaliações legítimas.',
      priority: 'alta',
    });
  }

  if (reviews >= 30) strengths.push(`Volume relevante de avaliações: ${reviews}.`);
  else {
    weaknesses.push(`Baixo volume de avaliações (${reviews}).`);
    recommendations.push({
      title: 'Aumentar avaliações',
      detail: 'Solicitar avaliações após cada atendimento e responder os novos comentários.',
      priority: reviews < 10 ? 'alta' : 'media',
    });
  }

  if (hasWebsite) strengths.push('Perfil possui site cadastrado.');
  else {
    weaknesses.push('Perfil sem site cadastrado.');
    recommendations.push({
      title: 'Adicionar presença digital',
      detail: 'Cadastrar um site ou página de conversão com WhatsApp e informações da empresa.',
      priority: 'alta',
    });
  }

  if (hasPhone) strengths.push('Telefone disponível para contato.');
  else {
    weaknesses.push('Telefone não encontrado no perfil.');
    recommendations.push({
      title: 'Cadastrar telefone',
      detail: 'Adicionar um número válido para facilitar ligações e conversões.',
      priority: 'alta',
    });
  }

  if (hoursCount > 0) strengths.push('Horários de funcionamento cadastrados.');
  else {
    weaknesses.push('Horários de funcionamento não identificados.');
    recommendations.push({
      title: 'Completar horários',
      detail: 'Cadastrar e manter os horários atualizados, inclusive em feriados.',
      priority: 'media',
    });
  }

  if (photos >= 5) strengths.push('Boa quantidade de fotos disponível na consulta.');
  else {
    weaknesses.push(`Poucas fotos retornadas pela consulta (${photos}).`);
    recommendations.push({
      title: 'Melhorar conteúdo visual',
      detail: 'Publicar fotos atuais da fachada, equipe, produtos e serviços.',
      priority: 'media',
    });
  }

  const summary = healthScore >= 80
    ? 'Perfil forte e completo, com oportunidades pontuais de diferenciação local.'
    : healthScore >= 60
      ? 'Perfil razoável, mas ainda existem pontos claros para melhorar visibilidade e conversão.'
      : 'Perfil com lacunas importantes e boa oportunidade comercial para otimização local.';

  return {
    has_website: hasWebsite,
    rating,
    review_count: reviews,
    photo_count: photos,
    health_score: healthScore,
    opportunity: summary,
    analysis_data: {
      summary,
      strengths,
      weaknesses,
      recommendations,
      metrics: { reputation, visibility, completeness, conversion },
      business_status: readText(place.businessStatus),
      opening_hours_count: hoursCount,
    },
    analysed_at: new Date().toISOString(),
  };
}

function mapPlace(place: PlaceRecord, fallbackCategory = '', fallbackCity = '') {
  const type = readDisplayName(place.primaryTypeDisplayName);
  const location = readLocation(place.location);
  return {
    google_place_id: readText(place.id),
    company_name: readDisplayName(place.displayName) || 'Empresa sem nome',
    category: type || fallbackCategory || null,
    city: fallbackCity || null,
    address: readText(place.formattedAddress),
    phone: readText(place.nationalPhoneNumber) || readText(place.internationalPhoneNumber),
    whatsapp: readText(place.nationalPhoneNumber) || readText(place.internationalPhoneNumber),
    google_maps_url: readText(place.googleMapsUri),
    website_url: readText(place.websiteUri),
    latitude: location.latitude,
    longitude: location.longitude,
    ...analysePlace(place),
  };
}

async function loadGoogleConfiguration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serverSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  let stored: { google_key: string | null; google_maps_browser_key: string | null } | null = null;
  if (supabaseUrl && serverSecret) {
    const serverClient = createClient(supabaseUrl, serverSecret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await serverClient
      .from('settings')
      .select('google_key,google_maps_browser_key')
      .eq('id', 1)
      .maybeSingle();
    stored = data;
  }
  return {
    placesKey: process.env.GOOGLE_PLACES_API_KEY || stored?.google_key || '',
    mapsBrowserKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || stored?.google_maps_browser_key || '',
  };
}

async function authorize(request: NextRequest, required: 'prospeccao' | 'analises' | 'any') {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!supabaseUrl || !publishableKey) {
    return { error: NextResponse.json({ error: 'Supabase não configurado no servidor.' }, { status: 500 }) };
  }
  if (!accessToken) {
    return { error: NextResponse.json({ error: 'Sessão ausente.' }, { status: 401 }) };
  }

  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: current } = await client.auth.getUser(accessToken);
  if (!current.user) {
    return { error: NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 }) };
  }
  const { data: profile } = await client
    .from('profiles')
    .select('role,permissions,is_active')
    .eq('id', current.user.id)
    .maybeSingle();
  const permissions = (profile?.permissions || []).map((item: string) => item.toLocaleLowerCase('pt-BR'));
  const isAdmin = ['admin', 'administrador'].includes((profile?.role || '').toLowerCase());
  const allowed = required === 'any'
    || (required === 'prospeccao'
      ? permissions.some((item: string) => ['prospecção', 'prospeccao'].includes(item))
      : permissions.some((item: string) => ['análises', 'analises'].includes(item)));
  if (!profile?.is_active || (!isAdmin && !allowed)) {
    return {
      error: NextResponse.json(
        { error: `Seu perfil não possui acesso a ${required === 'prospeccao' ? 'prospecção' : 'análises'}.` },
        { status: 403 },
      ),
    };
  }
  return { error: null };
}

export async function GET(request: NextRequest) {
  const authorization = await authorize(request, 'any');
  if (authorization.error) return authorization.error;
  const configuration = await loadGoogleConfiguration();
  return NextResponse.json({
    placesConfigured: Boolean(configuration.placesKey),
    mapsConfigured: Boolean(configuration.mapsBrowserKey),
    mapsBrowserKey: configuration.mapsBrowserKey || null,
  }, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const action = body.action === 'analyze' ? 'analyze' : 'search';
  const authorization = await authorize(request, action === 'analyze' ? 'analises' : 'prospeccao');
  if (authorization.error) return authorization.error;

  const configuration = await loadGoogleConfiguration();
  const apiKey = configuration.placesKey;
  if (!apiKey) {
    return NextResponse.json({ error: 'A chave do Google Places ainda não foi cadastrada em Administração → Integrações.' }, { status: 500 });
  }

  if (action === 'analyze') {
    const placeId = String(body.placeId || '').trim();
    if (!placeId) return NextResponse.json({ error: 'Este lead não possui um Place ID do Google.' }, { status: 400 });
    const detailsResponse = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pt-BR&regionCode=BR`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': detailFieldMask,
        },
      },
    );
    const details = await detailsResponse.json();
    if (!detailsResponse.ok) {
      return NextResponse.json(
        { error: details?.error?.message || 'Não foi possível atualizar a análise no Google Places.' },
        { status: detailsResponse.status },
      );
    }
    return NextResponse.json({ place: mapPlace(details) });
  }

  const category = String(body.category || '').trim();
  const city = String(body.city || '').trim();
  const maxResults = Math.min(Math.max(Number(body.maxResults) || 10, 1), 20);
  if (!category || !city) {
    return NextResponse.json({ error: 'Informe o segmento e a cidade/região.' }, { status: 400 });
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': searchFieldMask,
    },
    body: JSON.stringify({
      textQuery: `${category} em ${city}`,
      languageCode: 'pt-BR',
      regionCode: 'BR',
      pageSize: maxResults,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    return NextResponse.json(
      { error: data?.error?.message || 'Não foi possível consultar o Google Places.' },
      { status: response.status },
    );
  }

  const places = (data.places || [])
    .filter((place: PlaceRecord) => place.businessStatus !== 'CLOSED_PERMANENTLY')
    .map((place: PlaceRecord) => mapPlace(place, category, city));

  return NextResponse.json({ places });
}
