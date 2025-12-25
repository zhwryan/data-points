import { MatchData } from "../types";

export class MatchDataService {
  private readonly PROXY_BASE = '/api/proxy';

  constructor() {}

  /**
   * Fetches match data from the external API via proxy
   */
  public async fetchMatchData(input: string): Promise<{ data: MatchData, sources: any[] }> {
    try {
      // 1. Parse URL/Input
      const { matchId, sportType } = this.parseInput(input);
      
      if (!matchId) {
        throw new Error("Invalid match ID or URL");
      }

      console.log(`Fetching match data for ID: ${matchId}, SportType: ${sportType}`);

      // 2. Prepare Requests (Parallel Fetch)
      // We need both MatchInfo (names) and MatchDetail (stats/players)
      const [infoResponse, detailResponse] = await Promise.all([
        this.fetchMatchInfo(matchId, sportType),
        this.fetchMatchDetail(matchId, sportType)
      ]);

      // 3. Parse and Combine
      return this.combineData(infoResponse, detailResponse, matchId);

    } catch (error) {
      console.error("MatchDataService Error:", error);
      throw error;
    }
  }

  private async fetchMatchInfo(matchId: number, sportType: number): Promise<any> {
    const url = `${this.PROXY_BASE}/api/MatchInfo`;
    const payload = {
      sportType: sportType,
      MatchID: matchId,
      AccessPassword: null
    };
    return this.postRequest(url, payload);
  }

  private async fetchMatchDetail(matchId: number, sportType: number): Promise<any> {
    const url = `${this.PROXY_BASE}/api/MatchDetail`;
    const payload = {
      sportType: sportType,
      MatchID: matchId,
      tabId: "4529f187-1492-4556-a756-affa52458fd1", // Default tab for Match Status
      AccessPassword: null
    };
    return this.postRequest(url, payload);
  }

  private async postRequest(url: string, payload: any): Promise<any> {
    const headers = {
      "accept": "*/*",
      "accept-language": "zh-CN,zh;q=0.9",
      "content-type": "application/json",
      "deviceid": "8b9c24b380d74c869214dfa18a743d49",
      "product": "v1.0.300-rls",
      "sec-ch-ua": '"Chromium";v="129", "Not=A?Brand";v="8"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "cross-site",
      "source": "3",
      "useragent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      "usertoken": "79E47D60A4E14650F58AB5F31648A0C2D93BC404ECC2592816B385CE3EF0C0B8DE5E60E355F9E58B77A56314D6E593A66157DA1465A045B408B3F425FC2015E2811DBA6E6D6AA48C849F406F6149DB5D",
      "versions": "119"
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    if (!json || !json.data) {
      // Some APIs might return empty data or error code in body
      console.warn(`Empty data from ${url}`, json);
      return {}; 
    }
    return json.data;
  }

  private parseInput(input: string): { matchId: number | null, sportType: number } {
    if (!input) return { matchId: null, sportType: 1 };
    
    let matchId: number | null = null;
    let sportType: number = 1; // Default to basketball

    // Check if input is just digits
    if (/^\d+$/.test(input.trim())) {
      return { matchId: parseInt(input.trim(), 10), sportType: 1 };
    }

    try {
      const urlObj = new URL(input);
      const params = new URLSearchParams(urlObj.search);

      // Extract matchid from query or path
      if (params.has('matchid')) {
        matchId = parseInt(params.get('matchid')!, 10);
      } else {
        // Try path match
        const pathMatch = urlObj.pathname.match(/\/match\/detail\/(\d+)/i) || 
                          urlObj.pathname.match(/\/match\/(\d+)/i);
        if (pathMatch) {
          matchId = parseInt(pathMatch[1], 10);
        }
      }

      // Extract sportType
      if (params.has('sportType')) {
        sportType = parseInt(params.get('sportType')!, 10);
      }

      // Handle fragment parameters (common in SPAs)
      if (urlObj.hash) {
        const hashParts = urlObj.hash.split('?');
        if (hashParts.length > 1) {
          const hashParams = new URLSearchParams(hashParts[1]);
          if (hashParams.has('matchid')) {
            matchId = parseInt(hashParams.get('matchid')!, 10);
          }
          if (hashParams.has('sportType')) {
            sportType = parseInt(hashParams.get('sportType')!, 10);
          }
        }
      }

    } catch (e) {
      // Fallback regex if URL parsing fails
      const matchIdMatch = input.match(/[?&]matchid=(\d+)/i) || input.match(/\/match\/(\d+)/i) || input.match(/(\d{6,})/);
      if (matchIdMatch) {
        matchId = parseInt(matchIdMatch[1], 10);
      }
      
      const sportTypeMatch = input.match(/[?&]sportType=(\d+)/i);
      if (sportTypeMatch) {
        sportType = parseInt(sportTypeMatch[1], 10);
      }
    }

    return { matchId, sportType };
  }

  private combineData(matchInfo: any, detailData: any, matchId: number): { data: MatchData, sources: any[] } {
    const modeData = detailData.modeData || [];

    // Extract basic info from matchInfo
    const homeName = matchInfo.homeTeamName || "主队";
    const awayName = matchInfo.awayTeamName || "客队";

    // Initialize data containers
    let homePlayers: string[] = [];
    let awayPlayers: string[] = [];
    let homeScores: number[] = [0, 0, 0, 0];
    let awayScores: number[] = [0, 0, 0, 0];
    let homeTotal = 0;
    let awayTotal = 0;

    // Find Player Stats Section
    const playerStatsSection = modeData.find((section: any) => 
      section.homePlayers && Array.isArray(section.homePlayers)
    );

    if (playerStatsSection) {
      homePlayers = (playerStatsSection.homePlayers as any[]).map(p => {
        const name = p.playerName || "Unknown";
        return name;
      });
      
      awayPlayers = (playerStatsSection.awayPlayers as any[]).map(p => {
        const name = p.playerName || "Unknown";
        return name;
      });
    }

    // Find Score Section
    const scoreSection = modeData.find((section: any) => 
      section.sectionList && 
      section.sectionList[0] && 
      section.sectionList[0].homeList
    );

    if (scoreSection) {
      const hl = scoreSection.sectionList[0].homeList; // [total, q1, q2, q3, q4, ...]
      const al = scoreSection.sectionList[0].awayList;
      
      if (hl && hl.length > 0) {
        // hl structure appears to be: [id?, q1, q2, q3, q4, ?, total, url...]
        // Python script uses indices 1-4 for quarters and 6 for total.
        homeTotal = Number(hl.length > 6 ? hl[6] : hl[0]);
        if (isNaN(homeTotal)) homeTotal = 0;

        // Ensure exactly 4 items for the UI grid, parsing strings to numbers
        const rawScores = hl.slice(1, 5);
        homeScores = Array.from({ length: 4 }).map((_, i) => {
          const val = rawScores[i];
          // If value is missing or not a number, default to 0
          if (val === undefined || val === null || val === '') return 0;
          const num = Number(val);
          return isNaN(num) ? 0 : num;
        });
      }
      
      if (al && al.length > 0) {
        awayTotal = Number(al.length > 6 ? al[6] : al[0]);
        if (isNaN(awayTotal)) awayTotal = 0;

        const rawScores = al.slice(1, 5);
        awayScores = Array.from({ length: 4 }).map((_, i) => {
          const val = rawScores[i];
          if (val === undefined || val === null || val === '') return 0;
          const num = Number(val);
          return isNaN(num) ? 0 : num;
        });
      }
    }

    const resultData: MatchData = {
      home: {
        name: homeName,
        scores: homeScores,
        players: homePlayers,
        total: homeTotal
      },
      away: {
        name: awayName,
        scores: awayScores,
        players: awayPlayers,
        total: awayTotal
      }
    };

    const sources = [{
      title: '小球迷网',
      uri: `https://www.xiaoqiumi.com/m/match/detail/${matchId}`
    }];

    return { data: resultData, sources };
  }
}
