// Cliente Skyscanner via RapidAPI (flights-sky) — portado de Bayu v1 (Next.js).
// Búsqueda REAL de vuelos, hoteles y aeropuertos con precios y links de booking.
// Requiere env var RAPIDAPI_KEY (Vercel). El prefijo _ evita que Vercel lo exponga como function.

const HOST = 'flights-sky.p.rapidapi.com';
const BASE = `https://${HOST}`;

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-rapidapi-host': HOST,
    'x-rapidapi-key': process.env.RAPIDAPI_KEY || ''
  };
}

export function hasKey() {
  return Boolean(process.env.RAPIDAPI_KEY);
}

// El upstream del provider se cae intermitente (502/500 envueltos en HTTP 400) → 1 retry con backoff
async function skyGet(path, attempt = 0) {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  if (!res.ok) {
    const text = await res.text();
    if (attempt < 1 && (text.includes('502 Bad Gateway') || text.includes('500 INTERNAL'))) {
      await new Promise((r) => setTimeout(r, 1500));
      return skyGet(path, attempt + 1);
    }
    throw new Error(`Skyscanner API error ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// Autocomplete de lugares — resuelve texto libre ("Bilbao", "CDG") a IDs de Skyscanner
export async function resolvePlace(query) {
  const data = await skyGet(`/flights/auto-complete?query=${encodeURIComponent(query)}`);
  const first = (data.data || [])[0];
  if (!first) return null;
  return {
    name: first.presentation?.title || '',
    subtitle: first.presentation?.subtitle || '',
    skyId: first.navigation?.relevantFlightParams?.skyId || first.presentation?.skyId || '',
    entityId: first.navigation?.relevantFlightParams?.entityId || first.navigation?.entityId || '',
    hotelEntityId: first.navigation?.relevantHotelParams?.entityId || '',
    entityType: first.navigation?.entityType || ''
  };
}

export async function searchAirports(query) {
  const data = await skyGet(`/flights/auto-complete?query=${encodeURIComponent(query)}`);
  return (data.data || []).map((item) => ({
    skyId: item.navigation?.relevantFlightParams?.skyId || item.presentation?.skyId || '',
    entityId: item.navigation?.relevantFlightParams?.entityId || item.navigation?.entityId || '',
    entityType: item.navigation?.entityType || '',
    name: item.presentation?.title || '',
    subtitle: item.presentation?.subtitle || '',
    iataCode: item.navigation?.relevantFlightParams?.skyId || item.presentation?.skyId || ''
  }));
}

// Vuelos one-way o roundtrip. origin/destination aceptan texto libre o skyId (3 letras).
export async function searchFlights(params) {
  const cur = params.currency || 'MXN';
  const [from, to] = await Promise.all([
    looksLikeSkyId(params.origin) ? Promise.resolve({ skyId: params.origin.toUpperCase() }) : resolvePlace(params.origin),
    looksLikeSkyId(params.destination) ? Promise.resolve({ skyId: params.destination.toUpperCase() }) : resolvePlace(params.destination)
  ]);
  if (!from?.skyId || !to?.skyId) throw new Error('No se pudo resolver origen o destino');

  const qs = new URLSearchParams({
    fromEntityId: from.skyId,
    toEntityId: to.skyId,
    departDate: params.date,
    adults: String(params.adults || 1),
    cabinClass: params.cabinClass || 'economy',
    currency: cur,
    market: 'MX',
    countryCode: 'MX',
    locale: 'es-MX'
  });
  if (params.returnDate) qs.set('returnDate', params.returnDate);

  const endpoint = params.returnDate
    ? `/flights/search-roundtrip?${qs}`
    : `/flights/search-one-way?${qs}`;

  const data = await skyGet(endpoint);
  if (!data.data) return [];

  // Resultados incompletos → poll una vez por la sesión completa
  const ctx = data.data.context || {};
  let allItineraries = data.data.itineraries || [];
  if (ctx.status === 'incomplete' && ctx.sessionId) {
    try {
      const pollQs = new URLSearchParams({
        sessionId: ctx.sessionId, currency: cur, market: 'MX', countryCode: 'MX', locale: 'es-MX'
      });
      const pollData = await skyGet(`/flights/search-incomplete?${pollQs}`);
      if (pollData.data?.itineraries?.length) allItineraries = pollData.data.itineraries;
    } catch { /* si falla el poll, usar resultados iniciales */ }
  }

  return parseItineraries(allItineraries, cur);
}

function looksLikeSkyId(s) {
  return typeof s === 'string' && /^[A-Za-z]{3,4}$/.test(s.trim());
}

function parseLeg(leg) {
  if (!leg) return null;
  const segments = leg.segments || [];
  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];
  const carriers = leg.carriers?.marketing || [];
  return {
    airline: carriers[0]?.name || firstSeg?.marketingCarrier?.name || '',
    airlineCode: carriers[0]?.alternateId || firstSeg?.marketingCarrier?.alternateId || '',
    airlineLogo: carriers[0]?.logoUrl || '',
    flightNumber: firstSeg ? `${firstSeg.marketingCarrier?.alternateId || ''}${firstSeg.flightNumber || ''}` : '',
    departureAirport: leg.origin?.displayCode || '',
    departureCity: leg.origin?.city || leg.origin?.name || '',
    departureAt: firstSeg?.departure || leg.departure || '',
    arrivalAirport: leg.destination?.displayCode || '',
    arrivalCity: leg.destination?.city || leg.destination?.name || '',
    arrivalAt: lastSeg?.arrival || leg.arrival || '',
    durationMin: leg.durationInMinutes || 0,
    stops: leg.stopCount ?? Math.max(segments.length - 1, 0),
    nextDayArrival: (leg.timeDeltaInDays || 0) > 0,
    segments: segments.map((seg) => ({
      origin: seg.origin?.displayCode || '',
      destination: seg.destination?.displayCode || '',
      departure: seg.departure || '',
      arrival: seg.arrival || '',
      flightNumber: `${seg.marketingCarrier?.alternateId || ''}${seg.flightNumber || ''}`,
      airline: seg.marketingCarrier?.name || ''
    }))
  };
}

function parseItineraries(itineraries, currency) {
  const results = [];
  for (const item of itineraries) {
    const legs = item.legs || [];
    const outbound = parseLeg(legs[0]);
    if (!outbound) continue;
    const ret = parseLeg(legs[1]);
    const firstDep = outbound.departureAt;

    let bookingUrl = `https://www.skyscanner.com.mx/transport/flights/${outbound.departureAirport.toLowerCase()}/${outbound.arrivalAirport.toLowerCase()}/${dateForUrl(firstDep)}/`;
    bookingUrl += ret
      ? `${dateForUrl(ret.departureAt)}/?adultsv2=1&cabinclass=economy&rtn=1`
      : `?adultsv2=1&cabinclass=economy`;

    results.push({
      id: item.id || `sky-${results.length}`,
      price: item.price?.raw || 0,
      priceFormatted: item.price?.formatted || '',
      currency,
      isSelfTransfer: item.isSelfTransfer || false,
      score: item.score || 0,
      tags: item.tags || [],
      outbound,
      return: ret,
      bookingUrl
    });
  }
  results.sort((a, b) => a.price - b.price);
  return results;
}

function dateForUrl(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('T')[0].split('-');
  return `${y.slice(2)}${m}${d}`;
}

// Hoteles por ciudad (texto libre) con precios reales por partner + booking URLs
export async function searchHotels(params) {
  const cur = params.currency || 'MXN';
  const place = await resolvePlace(params.city);
  if (!place?.hotelEntityId) throw new Error(`Ciudad no encontrada para hoteles: ${params.city}`);

  const qs = new URLSearchParams({
    entityId: place.hotelEntityId,
    checkin: params.checkin,
    checkout: params.checkout,
    adults: String(params.adults || 2),
    currency: cur,
    market: 'MX',
    countryCode: 'MX',
    locale: 'es-MX'
  });

  const data = await skyGet(`/hotels/search?${qs}`);
  if (!data.data?.results?.hotelCards) return [];

  const nights = Math.max(1, Math.round(
    (new Date(params.checkout).getTime() - new Date(params.checkin).getTime()) / 86400000
  ));

  return data.data.results.hotelCards.map((h) => ({
    id: h.hotelId || h.id,
    name: h.name,
    stars: h.stars === 'no_stars' ? 0 : parseInt(h.stars) || 0,
    distance: h.distance || '',
    relevantPoiDistance: h.relevantPoiDistance || '',
    lat: h.coordinates?.latitude || null,
    lng: h.coordinates?.longitude || null,
    image: h.images?.[0]?.replace('_WxH', '_500x500') || null,
    reviewScore: h.reviewsSummary?.score || null,
    reviewDesc: h.reviewsSummary?.scoreDesc || null,
    reviewCount: h.reviewsSummary?.total || 0,
    amenities: h.amenities || [],
    pricePerNight: h.lowestPrice?.rawPrice || 0,
    priceWithTaxes: h.lowestPrice?.priceWithAllTaxes || '',
    priceFormatted: h.lowestPrice?.price || '',
    currency: cur,
    nights,
    partnerName: h.lowestPrice?.partnerName || '',
    bookingUrl: h.lowestPrice?.url || '',
    otherPrices: (h.otherPrices || []).map((p) => ({
      partner: p.name, price: p.price, rawPrice: p.rawPrice, url: p.url
    }))
  }));
}

// ——— Versiones compactas para Claudia (control de tokens) ———

export function compactFlights(results, limit = 5) {
  return results.slice(0, limit).map((f) => ({
    price: f.priceFormatted || `${f.price} ${f.currency}`,
    ida: legSummary(f.outbound),
    regreso: f.return ? legSummary(f.return) : undefined,
    selfTransfer: f.isSelfTransfer || undefined,
    link: f.bookingUrl
  }));
}

function legSummary(leg) {
  const dur = `${Math.floor(leg.durationMin / 60)}h${String(leg.durationMin % 60).padStart(2, '0')}`;
  const stops = leg.stops === 0 ? 'directo' : `${leg.stops} escala${leg.stops > 1 ? 's' : ''}`;
  return `${leg.airline} ${leg.flightNumber} · ${leg.departureAirport} ${hhmm(leg.departureAt)} → ${leg.arrivalAirport} ${hhmm(leg.arrivalAt)}${leg.nextDayArrival ? ' (+1d)' : ''} · ${dur} · ${stops}`;
}

function hhmm(iso) {
  return iso ? iso.split('T')[1]?.slice(0, 5) || '' : '';
}

export function compactHotels(results, limit = 6) {
  return results.slice(0, limit).map((h) => ({
    nombre: h.name,
    estrellas: h.stars || undefined,
    review: h.reviewScore ? `${h.reviewScore}/5 (${h.reviewCount} reseñas, ${h.reviewDesc})` : undefined,
    zona: h.relevantPoiDistance || h.distance || undefined,
    precioNoche: h.priceFormatted || `${h.pricePerNight} ${h.currency}`,
    totalConImpuestos: h.priceWithTaxes || undefined,
    noches: h.nights,
    vendidoPor: h.partnerName || undefined,
    foto: h.image || undefined,
    link: h.bookingUrl || undefined
  }));
}
