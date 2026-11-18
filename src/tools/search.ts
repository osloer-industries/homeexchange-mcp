import { api, z, zodTool, type Tool } from './tool-common';

const searchArgsSchema = z.object({
  adults: z.number().optional(),
  children: z.number().optional(),
  guests: z.number().optional(),
  checkin: z.string().optional(),
  checkout: z.string().optional(),
  exchange_type: z.enum(['GuestPoints', 'simultaneous', 'non_simultaneous']).optional(),
  home_id: z.string().optional(),
  home_type: z.enum(['house', 'apartment', 'other']).optional(),
  limit: z.number().optional(),
  location: z.string().optional(),
  offset: z.number().optional(),
});
const homeIdArgs = z.object({ home_id: z.string().min(1) });
const limitArgs = z.object({ limit: z.number().optional() });
type Args = z.infer<typeof searchArgsSchema>;

const SEARCH_HEADERS: Record<string, string> = {
  'X-SEARCH-API-VERSION': 'v2',
  'X-LEGACY-RESPONSE': 'true',
};

export const searchTools: Tool[] = [
  zodTool(
    'search_homes',
    'Search HomeExchange homes by location, dates, guests, and exchange type.',
    searchArgsSchema,
  ),
  zodTool('get_home', 'Get full details for a HomeExchange listing by home ID.', homeIdArgs),
  zodTool(
    'get_home_calendar',
    'Get availability calendar for a home showing blocked and available dates.',
    homeIdArgs,
  ),
  zodTool(
    'get_recommendations',
    'Get personalised home recommendations based on your profile and history.',
    limitArgs,
  ),
  zodTool('list_my_homes', 'List your own HomeExchange listings.', z.object({})),
  zodTool('list_favorites', 'List your saved favourite homes.', limitArgs),
  zodTool('add_favorite', 'Save a home to your favourites.', homeIdArgs),
  zodTool('remove_favorite', 'Remove a home from your favourites.', homeIdArgs),
  zodTool('list_saved_searches', 'List your saved search filters.', limitArgs),
];

const geocodingFeatureSchema = z.object({
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z.object({ id: z.string().optional(), source: z.string().optional() }),
});
const geocodingResponseSchema = z.object({ features: z.array(geocodingFeatureSchema).optional() });
const optionalCoordinate = z.number().optional();
const coordinateFields = {
  lat: optionalCoordinate,
  latitude: optionalCoordinate,
  lng: optionalCoordinate,
  longitude: optionalCoordinate,
} as const;
const searchHomeSchema = z.object({
  ...coordinateFields,
  location: z.object(coordinateFields).optional(),
}).catchall(z.unknown());
const searchResponseSchema = z.object({
  homes: z.array(searchHomeSchema).optional(),
  results: z.array(searchHomeSchema).optional(),
}).catchall(z.unknown());

type GeocodedLocation = {
  bbox: { maxLat: number; maxLon: number; minLat: number; minLon: number };
  locationId: string;
  provider: string;
};
type SearchHome = z.infer<typeof searchHomeSchema>;
type SearchResponse = z.infer<typeof searchResponseSchema>;

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

  const body = geocodingResponseSchema.parse(await response.json());
  const feature = body.features?.[0];
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
  const parsedResponse = searchResponseSchema.parse(response);
  return location ? filterToLocation(parsedResponse, location) : parsedResponse;
}

function parseHomeId(args: Args): string {
  return homeIdArgs.parse(args).home_id;
}

const handlers: Record<string, (args: Args) => Promise<unknown>> = {
  search_homes: searchHomes,
  get_home: (args) => api.bff(`/homes/${parseHomeId(args)}`),
  get_home_calendar: (args) => api.get(`/v1/homes/${parseHomeId(args)}/calendar`),
  get_recommendations: (args) => api.bffPost('/search/recommendation', {}, { limit: String(numericParameter(args, 'limit', 8)) }),
  list_my_homes: () => api.bff('/v1/homes/me'),
  list_favorites: (args) => api.get('/v2/favorites/me', { 'filters[status]': '1', 'order_by[createdAt]': 'DESC', limit: String(numericParameter(args, 'limit', 20)) }),
  add_favorite: (args) => api.post('/v2/favorites', { homeId: parseHomeId(args) }),
  remove_favorite: (args) => api.del(`/v2/favorites/${parseHomeId(args)}`),
  list_saved_searches: (args) => api.bff('/search/saved-searches', { limit: String(numericParameter(args, 'limit', 100)) }),
};

export async function handleSearch(name: string, args: Args): Promise<unknown> {
  const handler = handlers[name];
  if (!handler) throw new Error(`Unknown search tool: ${name}`);
  return handler(searchArgsSchema.parse(args));
}
