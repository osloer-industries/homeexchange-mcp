import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { api } from '../api';

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
        guests:        { type: 'number', description: 'Number of guests' },
        exchange_type: { type: 'string', enum: ['GuestPoints', 'simultaneous', 'non_simultaneous'], description: 'Type of exchange' },
        home_type:     { type: 'string', enum: ['house', 'apartment', 'other'], description: 'Property type' },
        limit:         { type: 'number', description: 'Results per page (default 20, max 36)' },
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

type Args = Record<string, unknown>;

export async function handleSearch(name: string, args: Args): Promise<unknown> {
  switch (name) {
    case 'search_homes': {
      const body: Record<string, unknown> = {};
      if (args['location'])      body['location']      = args['location'];
      if (args['checkin'])       body['dateFrom']       = args['checkin'];
      if (args['checkout'])      body['dateTo']         = args['checkout'];
      if (args['guests'])        body['nbGuests']       = args['guests'];
      if (args['exchange_type']) body['exchangeTypes']  = [args['exchange_type']];
      if (args['home_type'])     body['homeTypes']      = [args['home_type']];
      const limit  = (args['limit']  as number | undefined) ?? 20;
      const offset = (args['offset'] as number | undefined) ?? 0;
      return api.bffPost('/search/homes', body, {
        limit: String(limit),
        offset: String(offset),
      });
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

    default:
      throw new Error(`Unknown search tool: ${name}`);
  }
}
