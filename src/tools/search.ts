import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { api } from '../api';
import { emptyInputTool, optionalLimitTool, requiredStringTool } from './tool-schema';

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
  requiredStringTool('get_home', 'Get full details for a HomeExchange listing by home ID.', {
    home_id: 'Numeric home ID',
  }),
  requiredStringTool('get_home_calendar', 'Get availability calendar for a home showing blocked and available dates.', {
    home_id: 'Numeric home ID',
  }),
  optionalLimitTool('get_recommendations', 'Get personalised home recommendations based on your profile and history.', 'Number of recommendations (default 8)'),
  emptyInputTool('list_my_homes', 'List your own HomeExchange listings.'),
  optionalLimitTool('list_favorites', 'List your saved favourite homes.', 'Number of results (default 20)'),
  requiredStringTool('add_favorite', 'Save a home to your favourites.', { home_id: 'Home ID to save' }),
  requiredStringTool('remove_favorite', 'Remove a home from your favourites.', { home_id: 'Home ID to remove' }),
  optionalLimitTool('list_saved_searches', 'List your saved search filters.', 'Number of results (default 100)'),
];

type Args = Record<string, unknown>;

interface GeocodingFeature {
  bbox?: [number, number, number, number];
  geometry: { coordinates: [number, number] };
  properties: { id?: string; source?: string };
}

interface GeocodingResponse {
  features?: GeocodingFeature[];
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

interface GeocodedLocation {
  bbox: { maxLat: number; maxLon: number; minLat: number; minLon: number };
  locationId: string;
  provider: string;
}

function limitArg(args: Args, defaultLimit: number): number {
  return (args['limit'] as number | undefined) ?? defaultLimit;
}

function homeId(args: Args): string {
  return args['home_id'] as string;
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

  const feature = ((await response.json()) as GeocodingResponse).features?.[0];
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
      adults: (args['adults'] as number | undefined) ?? (args['guests'] as number | undefined) ?? 2,
      children: (args['children'] as number | undefined) ?? 0,
    },
  };
  if (args['checkin'] && args['checkout']) {
    query['dateRanges'] = [{ from: args['checkin'], to: args['checkout'] }];
  }
  if (location) {
    query['locationId'] = location.locationId;
    query['provider'] = location.provider;
  }
  if (args['exchange_type']) query['exchangeTypes'] = [args['exchange_type']];
  if (args['home_type']) query['homeTypes'] = [args['home_type']];
  return { search_query: query };
}

export async function handleSearch(name: string, args: Args): Promise<unknown> {
  switch (name) {
    case 'search_homes': {
      const limit = Math.min(Math.max((args['limit'] as number | undefined) ?? 20, 1), 200);
      const offset = Math.max((args['offset'] as number | undefined) ?? 0, 0);
      const location = args['location'] ? await geocodeLocation(args['location'] as string) : undefined;
      const response = await api.bffPost<SearchResponse>('/search/homes', searchBody(args, location), {
        limit: String(limit),
        offset: String(offset),
      }, SEARCH_HEADERS);
      return location ? filterToLocation(response, location) : response;
    }

    case 'get_home':
      return api.bff(`/homes/${homeId(args)}`);

    case 'get_home_calendar':
      return api.get(`/v1/homes/${homeId(args)}/calendar`);

    case 'get_recommendations':
      return api.bffPost('/search/recommendation', {}, { limit: String(limitArg(args, 8)) });

    case 'list_my_homes':
      return api.bff('/v1/homes/me');

    case 'list_favorites':
      return api.get('/v2/favorites/me', {
        'filters[status]': '1',
        'order_by[createdAt]': 'DESC',
        limit: String(limitArg(args, 20)),
      });

    case 'add_favorite':
      return api.post('/v2/favorites', { homeId: homeId(args) });

    case 'remove_favorite':
      return api.del(`/v2/favorites/${homeId(args)}`);

    case 'list_saved_searches':
      return api.bff('/search/saved-searches', { limit: String(limitArg(args, 100)) });

    default:
      throw new Error(`Unknown search tool: ${name}`);
  }
}
