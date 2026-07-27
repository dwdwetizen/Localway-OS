import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeCalendarRequest,
  googleCalendarAccessToken,
  googleCalendarStatus,
  loadGoogleCalendarConfiguration,
} from '@/lib/google-calendar-server';

export async function POST(request: NextRequest) {
  const authorization = await authorizeCalendarRequest(request);
  if (authorization.error) return authorization.error;
  const configuration = await loadGoogleCalendarConfiguration();
  if (!configuration || !googleCalendarStatus(configuration).connected) {
    return NextResponse.json({ error: 'O Google Agenda central ainda não está conectado.', notConnected: true }, { status: 409 });
  }
  const body = await request.json();
  const companyName = String(body.companyName || '').trim();
  const start = new Date(String(body.start || ''));
  if (!companyName || Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: 'Empresa ou data da reunião inválida.' }, { status: 400 });
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const description = [
    `Empresa: ${companyName}`,
    body.decisionMakerName ? `Decisor: ${body.decisionMakerName}` : '',
    body.receptionistName ? `Atendimento: ${body.receptionistName}` : '',
    body.phone ? `Telefone: ${body.phone}` : '',
    body.whatsapp ? `WhatsApp: ${body.whatsapp}` : '',
    body.email ? `E-mail: ${body.email}` : '',
    body.googleMapsUrl ? `Google Maps: ${body.googleMapsUrl}` : '',
    body.notes ? `Observações: ${body.notes}` : '',
    '',
    'Agendado pelo LocalWay OS.',
  ].filter(Boolean).join('\n');
  const accessToken = await googleCalendarAccessToken(configuration);
  const calendarId = encodeURIComponent(configuration.calendar_id || 'primary');
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: `Reunião comercial — ${companyName}`,
        description,
        ...(body.address ? { location: String(body.address) } : {}),
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 30 },
            { method: 'email', minutes: 60 },
          ],
        },
      }),
      cache: 'no-store',
    },
  );
  const event = await response.json();
  if (!response.ok) {
    return NextResponse.json({
      error: event?.error?.message || 'O Google Agenda não conseguiu criar a reunião.',
    }, { status: response.status });
  }
  return NextResponse.json({
    eventId: String(event.id || ''),
    eventUrl: String(event.htmlLink || ''),
    calendarEmail: configuration.connected_email || '',
  });
}
