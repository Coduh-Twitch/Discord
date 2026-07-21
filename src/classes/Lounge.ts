import { get } from "axios";

export enum GameMode {
  MKWORLD_12P = "mkworld12p",
  MKWORLD_24P = "mkworld24p",
}

export type Rank =
  | "Grandmaster"
  | "Master"
  | "Diamond"
  | "Ruby"
  | "Sapphire"
  | "Platinum"
  | "Gold"
  | "Silver"
  | "Bronze"
  | "Iron";

export const GameModes = {
  [GameMode.MKWORLD_12P]: "12P",
  [GameMode.MKWORLD_24P]: "24P",
};

export interface MMRChange {
  changeId: number;
  newMmr: number;
  mmrDelta: number;
  reason: string;
  time: string;
  score: number;
  partnerScores: number[];
  partnerIds: number[];
  rank: number;
  tier: string;
  numTeams: number;
  numPlayers: number;
}

export interface Player {
  playerId: number;
  name: string;
  mkcId: number;
  registryId: number;
  countryCode: string;
  countryName: string;
  switchFc: string;
  isHidden: boolean;
  game: GameMode;
  season: number;
  mmr: number;
  maxMmr: number;
  overallRank: number;
  eventsPlayed: number;
  winRate: number;
  winsLastTen: number;
  lossesLastTen: number;
  winLossLastTen: string;
  gainLossLastTen: number;
  largestGain: number;
  largestGainTableId: number;
  averageScore: number;
  noSQAverageScore: number;
  averageLastTen: number;
  noSQAverageLastTen: number;
  partnerAverage: number;
  noSQPartnerAverage: number;
  mmrChanges: MMRChange[];
  nameHistory: {
    name: string;
    changedOn: string;
  }[];
  rank: Rank;
  registryLink: string;
}

export interface TableTeamScore {
  score: number;
  multiplier: number;
  prevMmr: number;
  newMmr: number;
  delta: number;
  playerId: number;
  playerName: string;
  playerDiscordId: string;
  playerCountryCode: string;
}

export interface TableTeam {
  rank: number;
  scores: TableTeamScore[];
}

export interface Table {
  id: number;
  game: string;
  season: number;
  createdOn: string;
  verifiedOn: string;
  numTeams: number;
  numPlayers: number;
  format: string;
  url: string;
  tier: string;
  teams: any[];
  tableMessageId: string;
  updateMessageId: string;
  authorId: string;
}

export default class Lounge {
  baseUrl: string;
  tableUrl: string;
  currentSeason: number;
  defaultGameMode: GameMode;

  constructor() {
    this.baseUrl = "https://lounge.mkcentral.com/api/player/details";
    this.tableUrl = "https://lounge.mkcentral.com/api/table";
    this.currentSeason = 3;
    this.defaultGameMode = GameMode.MKWORLD_12P;
  }

  async getPlayerStatsByName(
    name: string,
    gameMode: GameMode = this.defaultGameMode,
    season: number = this.currentSeason,
  ): Promise<Player | null> {
    const res = await get(
      `${this.baseUrl}?game=${gameMode}&name=${name}&season=${season}`,
    );
    return res.data || null;
  }

  async getPlayerStatsByMkcId(
    id: string,
    gameMode: GameMode = this.defaultGameMode,
    season: number = this.currentSeason,
  ): Promise<Player | null> {
    const res = await get(
      `${this.baseUrl}?game=${gameMode}&mkcid=${id}&season=${season}`,
    );
    return res.data || null;
  }

  async getPlayerStatsByLoungeId(
    id: string,
    gameMode: GameMode = this.defaultGameMode,
    season: number = this.currentSeason,
  ): Promise<Player | null> {
    const res = await get(
      `${this.baseUrl}?game=${gameMode}&id=${id}&season=${season}`,
    );
    return res.data || null;
  }

  async getPlayerStatsByDiscordId(
    id: string,
    gameMode: GameMode = this.defaultGameMode,
    season: number = this.currentSeason,
  ): Promise<Player | null> {
    const res = await get(
      `${this.baseUrl}?game=${gameMode}&discordId=${id}&season=${season}`,
    );
    return res.data || null;
  }

  async getTable(id: string): Promise<Table | null> {
    const res = await get(`${this.tableUrl}?tableId=${id}`);
    if (res.data) {
      (res.data as Table).url = `https://lounge.mkcentral.com${res.data.url}`;
    }
    return res.data || null;
  }
}
