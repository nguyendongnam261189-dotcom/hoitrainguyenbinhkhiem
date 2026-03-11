export interface Competition {
  id: string;
  name: string;
  date: string;
}

export interface Class {
  id: string;
  name: string;
  grade: string;
  competition_id: string;
}

export interface Event {
  id: string;
  name: string;
  competition_id: string;
  type: 'normal' | 'discipline' | 'hygiene';
  round_count: number;
  round_names?: string[];
  weight: number;
  is_locked: boolean;
}

export interface Judge {
  id: string;
  name: string;
  code?: string;
  competition_id: string;
}

export interface Score {
  id: string;
  class_id: string;
  event_id: string;
  judge_id: string;
  round: number;
  score: number;
  category?: string;
}

export interface PointConversion {
  rank: number;
  points: number;
}

export interface FullCompetitionData {
  competition: Competition;
  classes: Class[];
  events: Event[];
  judges: Judge[];
  scores: Score[];
  conversions: PointConversion[];
}
