import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeGoogleAdsRequest,
  googleAdsAccessToken,
  googleAdsHeaders,
  googleAdsStatus,
  loadGoogleAdsConfiguration,
} from '@/lib/google-ads-server';

type AdsError = { error?: { message?: string; details?: Array<{ errors?: Array<{ message?: string }> }> } };

function adsErrorMessage(result: AdsError) {
  const message = result.error?.details?.flatMap(detail => detail.errors || [])[0]?.message
    || result.error?.message
    || 'O Google Ads não conseguiu consultar as palavras-chave.';
  if (/developer token is only approved for use with test accounts/i.test(message)) {
    return 'O Developer Token do Google Ads ainda está limitado a contas de teste. Solicite Acesso Básico na Central da API da conta administradora para consultar volumes de contas reais.';
  }
  return message;
}

async function suggestGeoTarget(
  location: string,
  configuration: NonNullable<Awaited<ReturnType<typeof loadGoogleAdsConfiguration>>>,
  accessToken: string,
) {
  const response = await fetch('https://googleads.googleapis.com/v25/geoTargetConstants:suggest', {
    method: 'POST',
    headers: googleAdsHeaders(configuration, accessToken),
    body: JSON.stringify({
      locale: 'pt_BR',
      countryCode: 'BR',
      locationNames: { names: [location] },
    }),
    cache: 'no-store',
  });
  const result = await response.json();
  if (!response.ok) throw new Error(adsErrorMessage(result));
  const suggestions = Array.isArray(result.geoTargetConstantSuggestions)
    ? result.geoTargetConstantSuggestions
    : [];
  return suggestions.find((item: Record<string, unknown>) => {
    const constant = item.geoTargetConstant as Record<string, unknown> | undefined;
    return constant?.status === 'ENABLED';
  })?.geoTargetConstant?.resourceName as string | undefined;
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeGoogleAdsRequest(request);
  if (authorization.error) return authorization.error;
  try {
    return NextResponse.json(googleAdsStatus(await loadGoogleAdsConfiguration()));
  } catch {
    return NextResponse.json({ credentialsConfigured: false, connected: false });
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeGoogleAdsRequest(request);
  if (authorization.error) return authorization.error;
  const configuration = await loadGoogleAdsConfiguration();
  if (!configuration || !googleAdsStatus(configuration).connected) {
    return NextResponse.json({ error: 'Google Ads ainda não conectado pelo administrador.' }, { status: 400 });
  }
  const body = await request.json();
  const segment = String(body.segment || '').trim();
  const location = String(body.location || 'Fortaleza').trim();
  const keywords = (Array.isArray(body.keywords) ? body.keywords : [])
    .map((value: unknown) => String(value).trim())
    .filter((value: string) => value.length >= 2)
    .slice(0, 20);
  const seeds = keywords.length ? keywords : [segment];
  if (!seeds[0]) return NextResponse.json({ error: 'Selecione um segmento ou informe uma palavra-chave.' }, { status: 400 });

  try {
    const accessToken = await googleAdsAccessToken(configuration);
    const geoTarget = await suggestGeoTarget(location, configuration, accessToken);
    if (!geoTarget) {
      return NextResponse.json({ error: `O Google Ads não reconheceu “${location}” como localização segmentável.` }, { status: 400 });
    }
    const customerId = String(configuration.customer_id || '').replace(/\D/g, '');
    const response = await fetch(
      `https://googleads.googleapis.com/v25/customers/${customerId}:generateKeywordIdeas`,
      {
        method: 'POST',
        headers: googleAdsHeaders(configuration, accessToken),
        body: JSON.stringify({
          customerId,
          language: 'languageConstants/1014',
          geoTargetConstants: [geoTarget],
          keywordPlanNetwork: 'GOOGLE_SEARCH',
          keywordSeed: { keywords: seeds },
          includeAdultKeywords: false,
          pageSize: 50,
        }),
        cache: 'no-store',
      },
    );
    const result = await response.json();
    if (!response.ok) return NextResponse.json({ error: adsErrorMessage(result) }, { status: response.status });
    const ideas = (Array.isArray(result.results) ? result.results : []).map((item: Record<string, unknown>) => {
      const metrics = (item.keywordIdeaMetrics || {}) as Record<string, unknown>;
      const monthly = Array.isArray(metrics.monthlySearchVolumes) ? metrics.monthlySearchVolumes : [];
      return {
        keyword: String(item.text || ''),
        avgMonthlySearches: Number(metrics.avgMonthlySearches || 0),
        competition: String(metrics.competition || 'UNSPECIFIED'),
        competitionIndex: Number(metrics.competitionIndex || 0),
        lowTopOfPageBid: Number(metrics.lowTopOfPageBidMicros || 0) / 1_000_000,
        highTopOfPageBid: Number(metrics.highTopOfPageBidMicros || 0) / 1_000_000,
        monthlySearchVolumes: monthly,
      };
    }).sort((a: { avgMonthlySearches: number }, b: { avgMonthlySearches: number }) =>
      b.avgMonthlySearches - a.avgMonthlySearches);
    return NextResponse.json({
      ideas,
      location,
      geoTarget,
      disclaimer: 'Volumes do Google Ads são arredondados, incluem variantes próximas e não representam exclusivamente buscas no Google Maps.',
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Falha ao consultar o Google Ads.',
    }, { status: 500 });
  }
}
