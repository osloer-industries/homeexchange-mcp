import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleUser, userTools } from './user';

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('../api', () => ({ api: apiMock }));

describe('user tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.get.mockResolvedValue({ ok: true });
  });

  it('defines all user tools with a required user ID', () => {
    expect(userTools.map((tool) => tool.name)).toEqual([
      'get_user_profile',
      'get_user_achievements',
      'get_user_ratings',
    ]);
    for (const tool of userTools) {
      expect(tool.inputSchema.required).toEqual(['user_id']);
    }
  });

  it.each([
    ['get_user_profile', '/v1/users/123'],
    ['get_user_achievements', '/v1/achievement/123'],
    ['get_user_ratings', '/v1/ratings/123'],
  ])('routes %s to %s', async (name, endpoint) => {
    await expect(handleUser(name, { user_id: '123' })).resolves.toEqual({ ok: true });
    expect(apiMock.get).toHaveBeenCalledWith(endpoint);
  });

  it('rejects unknown user tools', async () => {
    await expect(handleUser('unknown', {})).rejects.toThrow('Unknown user tool: unknown');
  });
});
