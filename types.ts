
export type StatType = 
  | 'FT_MADE' | 'FT_MISS' 
  | '2PT_MADE' | '2PT_MISS' 
  | '3PT_MADE' | '3PT_MISS'
  | 'DEF_REB' | 'OFF_REB' 
  | 'ASSIST' | 'STEAL' 
  | 'BLOCK' | 'TURNOVER'
  | 'FOUL';

export interface Player {
  id: string;
  name: string;
  team: string;
}

export interface GameAction {
  id: string;
  playerId: string;
  playerName: string;
  team: string;
  type: StatType;
  timestamp: number;
}

export interface ScoreState {
  home: number[];
  away: number[];
}

export const STAT_LABELS: Record<StatType, string> = {
  FT_MADE: '罚球命中',
  FT_MISS: '罚球不中',
  '2PT_MADE': '两分命中',
  '2PT_MISS': '两分不中',
  '3PT_MADE': '三分命中',
  '3PT_MISS': '三分不中',
  DEF_REB: '防守篮板',
  OFF_REB: '进攻篮板',
  ASSIST: '助攻',
  STEAL: '抢断',
  BLOCK: '盖帽',
  TURNOVER: '失误',
  FOUL: '犯规'
};
