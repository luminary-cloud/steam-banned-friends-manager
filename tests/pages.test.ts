import { describe, expect, it } from 'vitest';
import {
  classifyRoute,
  isFriendsPage,
  isGroupMembersPage,
  profileSegment,
} from '../src/lib/pages';

describe('isFriendsPage', () => {
  const cases: Array<[string, boolean]> = [
    ['/id/cloud/friends', true],
    ['/id/cloud/friends/', true],
    ['/id/cloud/friends?tab=all', true],
    ['/profiles/76561198000000000/friends', true],
    ['/profiles/76561198000000000/friends/all', true],
    ['/id/cloud', false],
    ['/id/cloud/games', false],
    ['/profiles/76561198000000000', false],
    ['/groups/foo/members', false],
    ['/market/', false],
    ['/', false],
  ];
  for (const [path, expected] of cases) {
    it(`${path} -> ${expected}`, () => {
      expect(isFriendsPage(path)).toBe(expected);
    });
  }
});

describe('isGroupMembersPage', () => {
  const cases: Array<[string, boolean]> = [
    ['/groups/foo/members', true],
    ['/groups/foo/members/', true],
    ['/groups/foo/members?p=2', true],
    ['/groups/foo', false],
    ['/groups/foo/discussions', false],
    ['/id/cloud/friends', false],
  ];
  for (const [path, expected] of cases) {
    it(`${path} -> ${expected}`, () => {
      expect(isGroupMembersPage(path)).toBe(expected);
    });
  }
});

describe('classifyRoute', () => {
  it('classifies friends pages', () => {
    expect(classifyRoute('/id/cloud/friends')).toBe('friends');
    expect(classifyRoute('/profiles/76561198000000000/friends')).toBe(
      'friends',
    );
  });
  it('classifies group member pages', () => {
    expect(classifyRoute('/groups/foo/members')).toBe('group-members');
  });
  it('classifies everything else as other', () => {
    expect(classifyRoute('/id/cloud')).toBe('other');
    expect(classifyRoute('/market/')).toBe('other');
    expect(classifyRoute('/')).toBe('other');
  });
});

describe('profileSegment', () => {
  it('parses numeric profile', () => {
    expect(profileSegment('/profiles/76561198000000000/friends')).toEqual({
      kind: 'profiles',
      value: '76561198000000000',
    });
  });
  it('parses vanity profile', () => {
    expect(profileSegment('/id/cloud/friends')).toEqual({
      kind: 'id',
      value: 'cloud',
    });
  });
  it('decodes vanity URL encoding', () => {
    expect(profileSegment('/id/hello%20world')).toEqual({
      kind: 'id',
      value: 'hello world',
    });
  });
  it('returns null for unrelated paths', () => {
    expect(profileSegment('/groups/foo/members')).toBeNull();
    expect(profileSegment('/')).toBeNull();
  });
});
