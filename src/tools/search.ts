import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { api } from '../api';

// Public Jawg token embedded in the HomeExchange frontend bundle.
// Used for location autocomplete → geocoding bbox for geo-filtering.
const JAWG_TOKEN = '0TBfgpKVDC8hFv1ZpNqOAVxz6scfEDKDOKZ0L5h0JUEslxXqbaXbwi3SwjuzCJuh';

// Required headers discovered by analysing the HE mobile app BFF calls
// (commons.js bundle, assets.homeexchange.com). Without these the BFF
// returns HTTP 422 / downstream error.
const SEARCH_HEADERS: Record<string, string> = {
  'X-SEARCH-API-VERSION': 'v2',
  'X-LEGACY-RESPONSE': 'true',
  'Accept-Language': 'fr',
};

export const searchTools: Tool[] = [
  {
    name: 'search_homes',
    description: 'Search HomeExchange homes by location, dates, guests, and exchange type.',
    inputSchema: {
      type: 'object',
      properties: {
        location:      { type: 'string', description: 'City, region, or country name' },
        checkin:       { type: 'string', description: 'Check-in date (YYYY-MM-DD)' },
        checkout:      { type: 'string', description: 'Check-out date (YYYY-MM-DD)' },
        adults:        { type: 'number', description: 'Number of adults (default 2)' },
        children:      { type: 'number', description: 'Number of children (default 0)' },
        exchange_type: { type: 'string', enum: ['GuestPoints', 'simultaneous', 'non_simultaneous'], description: 'Type of exchange' },
        home_type:     { type: 'string', enum: ['house', 'apartment', 'other'], description: 'Property type' },
        limit:         { type: 'number', description: 'Results per page (default 20, max 200)' },
        offset:        { type: 'number', description: 'Pagination offset (default 0)' },
      },
    },
  },
  {
    name: 'get_home',
    description: 'Get full details for a HomeExchange listing by home ID.',
    inputSchema: {
      type: 'object',
      required: ['home_id'],
      properties: {
        home_id: { type: 'string', description: 'Numeric home ID' },
      },
    },
  },
  {
    name: 'get_home_calendar',
    description: 'Get availability calendar for a home showing blocked and available dates.',
    inputSchema: {
      type: 'object',
      required: ['home_id'],
      properties: {
        home_id: { type: 'string', description: 'Numeric home ID' },
      },
    },
  },
  {
    name: 'get_recommendations',
    description: 'Get personalised home recommendations based on your profile and history.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of recommendations (default 8)' },
      },
    },
  },
  {
    name: 'list_my_homes',
    description: 'List your own HomeExchange listings.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_favorites',
    description: 'List your saved favourite homes.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of results (default 20)' },
      },
    },
  },
  {
    name: 'add_favorite',
    description: 'Save a home to your favourites.',
    inputSchema: {
      type: 'object',
      required: ['home_id'],
      properties: {
        home_id: { type: 'string', description: 'Home ID to save' },
      },
    },
  },
  {
    name: 'remove_favorite',
    description: 'Remove a home from your favourites.',
    inputSchema: {
      type: 'object',
      required: ['home_id'],
      properties: {
        home_id: { type: 'string', description: 'Home ID to remove' },
      },
    },
  },
  {
    name: 'list_saved_searches',
    description: 'List your saved search filters.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of results (default 100)' },
      },
    },
  },
  {
    name: 'get_user_profile',
    description: "Get a member's public profile on HomeExchange.",
    inputSchema: {
      type: 'object',
      required: ['user_id'],
      properties: {
        user_id: { type: 'string', description: 'Numeric user ID' },
      },
    },
  },
];

type Args = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Jawg geocoding — resolves a location string to a bounding box.
// Returns null if the location cannot be resolved.
// ---------------------------------------------------------------------------
interface JawgFeature {
  geometry: { coordinates: [number, number] };
  bbox?: [number, number, number, number];
  properties: {
    id?: string;
    source?: string;
    label?: string;
  };
}

interface JawgResponse {
  features: JawgFeature[];
}

async function geocodeLocation(location: string): Promise<{
  locationId: string;
  provider: string;
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
} | null> {
  const url = new URL('https://api.jawg.io/places/v1/autocomplete');
  url.searchParams.set('text', location);
  url.searchParams.set('access-token', JAWG_TOKEN);
  url.searchParams.set('lang', 'fr');
  url.searchParams.set('size', '1');

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const data = (await res.json()) as JawgResponse;
  const feature = data.features?.[0];
  if (!feature) return null;

  const [lon, lat] = feature.geometry.coordinates;
  const locationId = feature.properties.id ?? '';
  const provider = feature.properties.source ?? 'openstreetmap';

  // Use the feature's own bbox if available, otherwise build a ~25 km box
  let minLat: number, maxLat: number, minLon: number, maxLon: number;
  if (feature.bbox) {
    [minLon, minLat, maxLon, maxLat] = feature.bbox;
  } else {
    const delta = 0.25; // ~25 km
    minLat = lat - delta;
    maxLat = lat + delta;
    minLon = lon - delta;
    maxLon = lon + delta;
  }

  return { locationId, provider, bbox: { minLat, maxLat, minLon, maxLon } };
}

// ---------------------------------------------------------------------------
// BFF search — the correct body format for POST /search/homes.
//
// Note: as of 2025, the BFF ignores the locationId/provider and returns
// up to 10 000 homes globally. We apply bbox filtering client-side.
// ---------------------------------------------------------------------------
interface BffHome {
  id: number | string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  location?: { lat?: number; lng?: number; latitude?: number; longitude?: number };
  [key: string]: unknown;
}

interface BffSearchResponse {
  results?: BffHome[];
  homes?: BffHome[];
  total?: number;
  [key: string]: unknown;
}

function getHomeLat(h: BffHome): number | undefined {
  return h.lat ?? h.latitude ?? h.location?.lat ?? h.location?.latitude;
}

function getHomeLng(h: BffHome): number | undefined {
  return h.lng ?? h.longitude ?? h.location?.lng ?? h.location?.longitude;
}

function buildSearchBody(args: Args, locationId?: string, provider?: string): Record<string, unknown> {
  const body: Record<string, unknown> = { search_query: {} };
  const sq: Record<string, unknown> = {};

  if (args['checkin'] && args['checkout']) {
    sq['dateRanges'] = [{ from: args['checkin'], to: args['checkout'] }];
  }

  if (locationId) {
    sq['locationId'] = locationId;
    sq['provider'] = provider ?? 'openstreetmap';
  }

  const adults   = (args['adults']   as number | undefined) ?? 2;
  const children = (args['children'] as number | undefined) ?? 0;
  sq['guests'] = { adults, children };

  if (args['exchange_type']) sq['exchangeTypes'] = [args['exchange_type']];
  if (args['home_type'])     sq['homeTypes']     = [args['home_type']];

  body['search_query'] = sq;
  return body;
}

export async function handleSearch(name: string, args: Args): Promise<unknown> {
  switch (name) {
    case 'search_homes': {
      const limit  = (args['limit']  as number | undefined) ?? 20;
      const offset = (args['offset'] as number | undefined) ?? 0;

      // Step 1 – geocode the location string
      let geoResult: Awaited<ReturnType<typeof geocodeLocation>> = null;
      if (args['location']) {
        geoResult = await geocodeLocation(args['location'] as string);
      }

      // Step 2 – build the BFF body with the correct format
      const body = buildSearchBody(
        args,
        geoResult?.locationId,
        geoResult?.provider,
      );

      // Step 3 – call the BFF with required headers
      // The BFF currently ignores location filtering and returns all homes;
      // we apply bbox filtering below to compensate.
      const pageSize = 200; // max the BFF accepts
      let collected: BffHome[] = [];

      if (geoResult) {
        // Scan enough pages to fill the requested window, filtering by bbox
        const { bbox } = geoResult;
        let page = 0;
        const maxPages = 50; // safety cap — 50 × 200 = 10 000 homes

        while (collected.length < offset + limit && page < maxPages) {
          const raw = await api.bffPost<BffSearchResponse>(
            '/search/homes',
            body,
            { limit: String(pageSize), offset: String(page * pageSize) },
            SEARCH_HEADERS,
          );
          const homes: BffHome[] = raw.results ?? raw.homes ?? [];
          if (homes.length === 0) break;

          const inBox = homes.filter((h) => {
            const lat = getHomeLat(h);
            const lon = getHomeLng(h);
            if (lat === undefined || lon === undefined) return false;
            return lat >= bbox.minLat && lat <= bbox.maxLat &&
                   lon >= bbox.minLon && lon <= bbox.maxLon;
          });
          collected = collected.concat(inBox);
          page++;
        }

        const page_results = collected.slice(offset, offset + limit);
        return { total: collected.length, results: page_results };
      }

      // No location — return raw BFF results for the requested page
      return api.bffPost<BffSearchResponse>(
        '/search/homes',
        body,
        { limit: String(limit), offset: String(offset) },
        SEARCH_HEADERS,
      );
    }

    case 'get_home':
      return api.bff(`/homes/${args['home_id'] as string}`);

    case 'get_home_calendar':
      return api.get(`/v1/homes/${args['home_id'] as string}/calendar`);

    case 'get_recommendations': {
      const limit = (args['limit'] as number | undefined) ?? 8;
      return api.bffPost('/search/recommendation', {}, { limit: String(limit) });
    }

    case 'list_my_homes':
      return api.bff('/v1/homes/me');

    case 'list_favorites': {
      const limit = (args['limit'] as number | undefined) ?? 20;
      return api.get('/v2/favorites/me', {
        'filters[status]': '1',
        'order_by[createdAt]': 'DESC',
        limit: String(limit),
      });
    }

    case 'add_favorite':
      return api.post('/v2/favorites', { homeId: args['home_id'] });

    case 'remove_favorite':
      return api.del(`/v2/favorites/${args['home_id'] as string}`);

    case 'list_saved_searches': {
      const limit = (args['limit'] as number | undefined) ?? 100;
      return api.bff('/search/saved-searches', { limit: String(limit) });
    }

    case 'get_user_profile':
      return api.bff(`/users/${args['user_id'] as string}`);

    default:
      throw new Error(`Unknown search tool: ${name}`);
  }
}
