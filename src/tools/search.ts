import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v3';
import { api } from '../api';

const searchArgsSchema = z.object({
  adults: z.number().optional(), children: z.number().optional(), guests: z.number().optional(),
  checkin: z.string().optional(), checkout: z.string().optional(), exchange_type: z.string().optional(),
  home_id: z.string().optional(), home_type: z.string().optional(), limit: z.number().optional(),
  location: z.string().optional(), offset: z.number().optional(),
}).passthrough();
type Args = z.infer<typeof searchArgsSchema>;

const SEARCH_HEADERS: Record<string, string> = {
  'X-SEARCH-API-VERSION': 'v2',
  'X-LEGACY-RESPONSE': 'true',
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
        guests:        { type: 'number', description: 'Total guests, retained for compatibility' },
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
];

interface GeocodingFeature {
  bbox?: [number, number, number, number];
  geometry: { coordinates: [number, number] };
  properties: { id?: string; source?: string };
}

interface GeocodingResponse {
  features?: GeocodingFeature[];
}

function isGeocodingResponse(value: unknown): value is GeocodingResponse {
  if (typeof value !== 'object' || value === null || !('features' in value)) return false;
  return Array.isArray(value.features);
}

interface SearchHome {
  lat?: number;
  latitude?: number;
  lng?: number;
  longitude?: number;
  location?: { lat?: number; latitude?: number; lng?: number; longitude?: number };
  [key: string]: unknown;
}

interface SearchResponse {
  homes?: SearchHome[];
  results?: SearchHome[];
  [key: string]: unknown;
}

function isSearchResponse(value: unknown): value is SearchResponse {
  return typeof value === 'object' && value !== null;
}

interface GeocodedLocation {
  bbox: { maxLat: number; maxLon: number; minLat: number; minLon: number };
  locationId: string;
  provider: string;
}

async function geocodeLocation(location: string): Promise<GeocodedLocation> {
  const token = process.env['HOMEEXCHANGE_GEOCODING_TOKEN'];
  if (!token) {
    throw new Error(
      'Searching by location requires HOMEEXCHANGE_GEOCODING_TOKEN. Set it to a personal geocoding API token before starting the MCP server.'
    );
  }

  const url = new URL('https://api.jawg.io/places/v1/autocomplete');
  url.searchParams.set('text', location);
  url.searchParams.set('access-token', token);
  url.searchParams.set('lang', 'en');
  url.searchParams.set('size', '1');

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not geocode ${location}.`);

  const body: unknown = await response.json();
  const feature = isGeocodingResponse(body) ? body.features?.[0] : undefined;
  if (!feature?.properties.id) throw new Error(`No location found for ${location}.`);

  const [lon, lat] = feature.geometry.coordinates;
  const [minLon, minLat, maxLon, maxLat] = feature.bbox ?? [lon - 0.25, lat - 0.25, lon + 0.25, lat + 0.25];
  return {
    locationId: feature.properties.id,
    provider: feature.properties.source ?? 'openstreetmap',
    bbox: { minLat, maxLat, minLon, maxLon },
  };
}

function homeCoordinates(home: SearchHome): [number, number] | undefined {
  const lat = home.lat ?? home.latitude ?? home.location?.lat ?? home.location?.latitude;
  const lon = home.lng ?? home.longitude ?? home.location?.lng ?? home.location?.longitude;
  return lat === undefined || lon === undefined ? undefined : [lat, lon];
}

function filterToLocation(response: SearchResponse, location: GeocodedLocation): SearchResponse {
  const homes = response.results ?? response.homes;
  if (!homes) return response;
  const filtered = homes.filter((home) => {
    const coordinates = homeCoordinates(home);
    if (!coordinates) return false;
    const [lat, lon] = coordinates;
    const { minLat, maxLat, minLon, maxLon } = location.bbox;
    return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
  });
  return response.results ? { ...response, results: filtered } : { ...response, homes: filtered };
}

function searchBody(args: Args, location?: GeocodedLocation): Record<string, unknown> {
  const query: Record<string, unknown> = {
    guests: {
      adults: args.adults ?? args.guests ?? 2,
      children: args.children ?? 0,
    },
  };
  if (args.checkin && args.checkout) {
    query['dateRanges'] = [{ from: args.checkin, to: args.checkout }];
  }
  if (location) {
    query['locationId'] = location.locationId;
    query['provider'] = location.provider;
  }
  if (args.exchange_type) query['exchangeTypes'] = [args.exchange_type];
  if (args.home_type) query['homeTypes'] = [args.home_type];
  return { search_query: query };
}

function numericParameter(args: Args, name: 'limit' | 'offset', fallback: number): number {
  return args[name] ?? fallback;
}

async function searchHomes(args: Args): Promise<SearchResponse> {
  const limit = Math.min(Math.max(numericParameter(args, 'limit', 20), 1), 200);
  const offset = Math.max(numericParameter(args, 'offset', 0), 0);
  const locationName = args.location;
  const location = locationName ? await geocodeLocation(locationName) : undefined;
  const response = await api.bffPost('/search/homes', searchBody(args, location), {
    limit: String(limit), offset: String(offset),
  }, SEARCH_HEADERS);
  if (!isSearchResponse(response)) throw new Error('Search returned an invalid response.');
  return location ? filterToLocation(response, location) : response;
}

const handlers: Record<string, (args: Args) => Promise<unknown>> = {
  search_homes: searchHomes,
  get_home: (args) => api.bff(`/homes/${z.string().min(1).parse(args.home_id)}`),
  get_home_calendar: (args) => api.get(`/v1/homes/${z.string().min(1).parse(args.home_id)}/calendar`),
  get_recommendations: (args) => api.bffPost('/search/recommendation', {}, { limit: String(numericParameter(args, 'limit', 8)) }),
  list_my_homes: () => api.bff('/v1/homes/me'),
  list_favorites: (args) => api.get('/v2/favorites/me', { 'filters[status]': '1', 'order_by[createdAt]': 'DESC', limit: String(numericParameter(args, 'limit', 20)) }),
  add_favorite: (args) => api.post('/v2/favorites', { homeId: args['home_id'] }),
  remove_favorite: (args) => api.del(`/v2/favorites/${z.string().min(1).parse(args.home_id)}`),
  list_saved_searches: (args) => api.bff('/search/saved-searches', { limit: String(numericParameter(args, 'limit', 100)) }),
};

export async function handleSearch(name: string, args: Args): Promise<unknown> {
  const handler = handlers[name];
  if (!handler) throw new Error(`Unknown search tool: ${name}`);
  return handler(searchArgsSchema.parse(args));
}
