export type RouteKind = 'friends' | 'group-members' | 'other';

const FRIENDS_RE = /^\/(?:profiles|id)\/[^/]+\/friends(?:\/|$|\?)/;
const GROUP_MEMBERS_RE = /^\/groups\/[^/]+\/members(?:\/|$|\?)/;

export const isFriendsPage = (pathname: string = location.pathname): boolean =>
  FRIENDS_RE.test(pathname);

export const isGroupMembersPage = (
  pathname: string = location.pathname,
): boolean => GROUP_MEMBERS_RE.test(pathname);

export const classifyRoute = (
  pathname: string = location.pathname,
): RouteKind => {
  if (isFriendsPage(pathname)) return 'friends';
  if (isGroupMembersPage(pathname)) return 'group-members';
  return 'other';
};

export const profileSegment = (
  pathname: string = location.pathname,
): { kind: 'profiles' | 'id'; value: string } | null => {
  const m = pathname.match(/^\/(profiles|id)\/([^/]+)/);
  if (!m) return null;
  return { kind: m[1] as 'profiles' | 'id', value: decodeURIComponent(m[2]!) };
};
