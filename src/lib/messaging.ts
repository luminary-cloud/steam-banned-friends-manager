export type BansRequest = { action: 'fetchBans'; batch: string[] };
export type SummariesRequest = { action: 'fetchSummaries'; batch: string[] };
export type VanityRequest = { action: 'resolveVanity'; vanity: string };
export type BgRequest = BansRequest | SummariesRequest | VanityRequest;

export type PlayerBan = {
  SteamId: string;
  CommunityBanned: boolean;
  VACBanned: boolean;
  NumberOfVACBans: number;
  DaysSinceLastBan: number;
  NumberOfGameBans: number;
  EconomyBan: string;
};

export type PlayerSummary = {
  steamid: string;
  communityvisibilitystate: number;
  personaname?: string;
  profileurl?: string;
};

export type BansResponse = {
  json?: { players?: PlayerBan[] };
  error?: string;
};

export type SummariesResponse = {
  json?: { response?: { players?: PlayerSummary[] } };
  error?: string;
};

export type VanityResponse = {
  steamid?: string;
  error?: string;
};

export type BgResponse = BansResponse | SummariesResponse | VanityResponse;

export const send = async <R extends BgResponse>(
  req: BgRequest,
): Promise<R> => {
  try {
    const resp = (await browser.runtime.sendMessage(req)) as R | undefined;
    return resp ?? ({ error: 'no response' } as R);
  } catch (e) {
    return { error: String(e) } as R;
  }
};
