export interface RawStory {
  title: string;
  summary: string;
  claude_take: string;
  link: string;
  read_time: string | number;
  pick_rank?: number | null;
}

export interface DigestRow {
  id: number;
  digest_date: string;
  stream_name: string;
  section_name: string;
  stories: RawStory[];
}

export interface Story {
  id: string;
  streamId: string;
  section: string;
  title: string;
  summary: string;
  take: string;
  url: string;
  readTime: number;
  pickRank: number | null;
}

export interface Stream {
  id: string;
  name: string;
  short: string;
  cssVar: string;
}

export interface DigestData {
  date: string;
  dayLabel: string;
  streams: Stream[];
  stories: Record<string, Story[]>;
  allStories: Story[];
  storyById: Record<string, Story>;
  topPicks: Story[];
  totalStories: number;
  totalReadMin: number;
}
