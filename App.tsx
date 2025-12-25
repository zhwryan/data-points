
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  RotateCcw, 
  Trash2, 
  Table, 
  FileText, 
  Zap,
  Users,
  Target,
  ClipboardList,
  ExternalLink,
  Search,
  Loader2,
  Trophy,
  Globe,
  LayoutGrid
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Player, GameAction, StatType, STAT_LABELS } from './types';

const INITIAL_ROSTER = "宏疆队:刘竞,吴维,宋延,连淼,阿鑫,庄国宇,郑宏伟,陈泓达;沐骁队:临时,张伟,施颐,林鸿,沐阳,陈超,刘先生,李志航";

const App: React.FC = () => {
  // --- 状态定义 ---
  const [matchUrl, setMatchUrl] = useState('400302960');
  const [playersText, setPlayersText] = useState(INITIAL_ROSTER);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [history, setHistory] = useState<GameAction[]>([]);
  const [redoStack, setRedoStack] = useState<GameAction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [groundingSources, setGroundingSources] = useState<{title: string, uri: string}[]>([]);
  
  // 计分板状态
  const [homeScores, setHomeScores] = useState<number[]>([26, 34, 30, 30]);
  const [awayScores, setAwayScores] = useState<number[]>([30, 25, 31, 30]);
  const [teamNames, setTeamNames] = useState<string[]>(['宏疆队', '沐骁队']);

  // --- 球员名单解析逻辑 ---
  useEffect(() => {
    const parseRoster = (text: string) => {
      const teamsArr = text.replace(/：/g, ':').replace(/，/g, ',').replace(/；/g, ';').split(';');
      const newPlayers: Player[] = [];
      const names: string[] = [];
      teamsArr.forEach(t => {
        const parts = t.split(':');
        if (parts.length >= 2) {
          const teamName = parts[0].trim();
          names.push(teamName);
          const pNames = parts[1].split(',').map(n => n.trim()).filter(n => n);
          pNames.forEach(n => {
            newPlayers.push({ id: `${teamName}-${n}`, name: n, team: teamName });
          });
        }
      });
      if (names.length >= 2) setTeamNames(names);
      return newPlayers;
    };
    const newPlayers = parseRoster(playersText);
    setPlayers(newPlayers);
    if (newPlayers.length > 0 && !selectedPlayerId) {
      setSelectedPlayerId(newPlayers[0].id);
    }
  }, [playersText]);

  const selectedPlayer = useMemo(() => 
    players.find(p => p.id === selectedPlayerId), 
  [players, selectedPlayerId]);

  // --- 核心功能：使用 Gemini 搜索增强抓取数据 (解决 CORS 失败问题) ---
  const handleFetchMatchData = async () => {
    if (!matchUrl.trim()) return alert("请输入有效链接或 MatchId");
    
    setIsLoading(true);
    setGroundingSources([]);

    // 提取 MatchID
    const matchIdMatch = matchUrl.match(/matchid=([0-9]+)/i);
    const matchId = matchIdMatch ? matchIdMatch[1] : (matchUrl.match(/^[0-9]+$/) ? matchUrl : matchUrl);
    
    try {
      // 初始化 AI 实例，作为“数据抓取引擎”
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const prompt = `查找小球迷(xiaoqiumi.com)比赛 ID ${matchId} 的数据详情。
      
      请获取并返回以下 JSON 格式的数据：
      {
        "home": { "name": "队名", "scores": [Q1, Q2, Q3, Q4], "players": ["球员1", "球员2"] },
        "away": { "name": "队名", "scores": [Q1, Q2, Q3, Q4], "players": ["球员1", "球员2"] }
      }
      
      注意：比分必须是第1到第4节的实时数据。`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.1,
        },
      });

      // 记录数据来源
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = chunks
        .filter((c: any) => c.web)
        .map((c: any) => ({ title: c.web.title, uri: c.web.uri }));
      setGroundingSources(sources);

      // 解析 AI 抓取到的数据
      const text = response.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        if (data.home && data.away) {
          setTeamNames([data.home.name, data.away.name]);
          setHomeScores(data.home.scores.slice(0, 4));
          setAwayScores(data.away.scores.slice(0, 4));
          setPlayersText(`${data.home.name}:${data.home.players.join(',')};${data.away.name}:${data.away.players.join(',')}`);
          alert(`同步成功！来自 [${data.home.name} VS ${data.away.name}] 的实时数据。`);
        }
      } else {
        alert("未获取到结构化数据，请确认比赛 ID 是否正确或比赛是否已开始。");
      }

    } catch (error: any) {
      console.error(error);
      alert("同步失败：浏览器 CORS 限制了直接访问。已尝试 AI 引擎抓取但未成功，请检查网络。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordStat = useCallback((type: StatType) => {
    if (!selectedPlayer) return alert("请先选择球员");
    const newAction: GameAction = {
      id: crypto.randomUUID(),
      playerId: selectedPlayer.id,
      playerName: selectedPlayer.name,
      team: selectedPlayer.team,
      type,
      timestamp: Date.now()
    };
    setHistory(prev => [newAction, ...prev]);
    setRedoStack([]);
  }, [selectedPlayer]);

  const handleUndo = () => {
    if (history.length === 0) return;
    const [last, ...rest] = history;
    setHistory(rest);
    setRedoStack(prev => [last, ...prev]);
  };

  const handleClear = () => {
    if (window.confirm("确定要清空所有记录吗？")) {
      setHistory([]);
      setRedoStack([]);
    }
  };

  const calculateStats = (pId: string) => {
    const pActions = history.filter(h => h.playerId === pId);
    const stats = { pts: 0, reb: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, foul: 0, ftm: 0, fta: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0 };
    pActions.forEach(a => {
      if (a.type === 'FT_MADE') { stats.pts += 1; stats.ftm += 1; stats.fta += 1; }
      if (a.type === 'FT_MISS') stats.fta += 1;
      if (a.type === '2PT_MADE') { stats.pts += 2; stats.fg2m += 1; stats.fg2a += 1; }
      if (a.type === '2PT_MISS') stats.fg2a += 1;
      if (a.type === '3PT_MADE') { stats.pts += 3; stats.fg3m += 1; stats.fg3a += 1; }
      if (a.type === '3PT_MISS') stats.fg3a += 1;
      if (a.type === 'OFF_REB') { stats.reb += 1; stats.oreb += 1; }
      if (a.type === 'DEF_REB') { stats.reb += 1; stats.dreb += 1; }
      if (a.type === 'ASSIST') stats.ast += 1;
      if (a.type === 'STEAL') stats.stl += 1;
      if (a.type === 'BLOCK') stats.blk += 1;
      if (a.type === 'TURNOVER') stats.tov += 1;
      if (a.type === 'FOUL') stats.foul += 1;
    });
    return stats;
  };

  const exportAsTable = () => {
    let csv = "姓名,球队,得分,篮板,助攻,抢断,盖帽,失误,犯规\n";
    players.forEach(p => {
      const s = calculateStats(p.id);
      csv += `${p.name},${p.team},${s.pts},${s.reb},${s.ast},${s.stl},${s.blk},${s.tov},${s.foul}\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `basketball_stats_${Date.now()}.csv`;
    link.click();
  };

  const currentPlayerStats = useMemo(() => selectedPlayerId ? calculateStats(selectedPlayerId) : null, [history, selectedPlayerId]);
  const teamsList = Array.from(new Set(players.map(p => p.team)));

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 font-sans p-3 md:p-6 lg:p-10">
      <div className="max-w-[1440px] mx-auto space-y-6 md:space-y-8">
        
        {/* 顶部配置面板 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 flex flex-col justify-between">
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <ClipboardList className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight">比赛打点配置</h1>
                  <p className="text-xs text-slate-400 font-bold tracking-widest uppercase mt-0.5">Game Analytics Dashboard</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] px-1 flex items-center gap-2">
                    <Globe className="w-3 h-3 text-indigo-500" /> 比赛链接 / MatchID
                  </label>
                  <div className="flex flex-wrap md:flex-nowrap gap-3">
                    <input 
                      className="flex-1 min-w-[200px] px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-semibold" 
                      value={matchUrl} 
                      onChange={e => setMatchUrl(e.target.value)} 
                      placeholder="粘贴 URL 或输入 MatchID" 
                    />
                    <div className="flex gap-2 w-full md:w-auto">
                      <button 
                        onClick={handleFetchMatchData} 
                        disabled={isLoading} 
                        className="flex-1 md:flex-none px-8 py-4 bg-slate-900 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        数据同步
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] px-1">球员名单管理</label>
                  <textarea 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm h-[90px] resize-none outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-semibold" 
                    value={playersText} 
                    onChange={e => setPlayersText(e.target.value)} 
                  />
                </div>

                {groundingSources.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-1">
                    {groundingSources.map((s, i) => (
                      <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full border border-indigo-100 flex items-center gap-1.5 hover:bg-indigo-100 transition-all font-bold">
                        <Globe className="w-2.5 h-2.5" /> {s.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 深色计分板 */}
          <div className="lg:col-span-5 bg-slate-900 rounded-[2.5rem] p-8 md:p-10 text-white shadow-2xl relative overflow-hidden flex flex-col justify-center border border-slate-800">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full -mr-32 -mt-32 blur-[80px]"></div>
            
            <div className="relative z-10 overflow-x-auto">
              <table className="w-full text-center tabular-nums min-w-[440px]">
                <thead>
                  <tr className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em]">
                    <th className="pb-10 text-left px-4">TEAM</th>
                    <th className="pb-10">Q1</th>
                    <th className="pb-10">Q2</th>
                    <th className="pb-10">Q3</th>
                    <th className="pb-10">Q4</th>
                    <th className="pb-10 text-indigo-400">TOT</th>
                  </tr>
                </thead>
                <tbody className="space-y-8">
                  {[0, 1].map(idx => {
                    const scores = idx === 0 ? homeScores : awayScores;
                    const total = scores.reduce((a, b) => a + b, 0);
                    return (
                      <tr key={idx} className={idx === 0 ? "border-b border-slate-800/60" : ""}>
                        <td className="py-6 text-left px-4">
                          <span className="font-black text-xl text-slate-100 block truncate max-w-[140px] tracking-tight">{teamNames[idx]}</span>
                        </td>
                        {scores.map((s, i) => (
                          <td key={i} className="py-6 px-1">
                            <input 
                              type="number" 
                              className="w-14 md:w-16 py-3.5 bg-slate-800/80 text-center rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/40 border border-slate-700/50 text-lg font-black transition-all" 
                              value={s} 
                              onChange={e => {
                                const newVal = parseInt(e.target.value) || 0;
                                if (idx === 0) {
                                  const n = [...homeScores]; n[i] = newVal; setHomeScores(n);
                                } else {
                                  const n = [...awayScores]; n[i] = newVal; setAwayScores(n);
                                }
                              }} 
                            />
                          </td>
                        ))}
                        <td className="py-6 px-4">
                          <span className="text-4xl md:text-5xl font-black text-indigo-400 tracking-tighter drop-shadow-lg">
                            {total}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 交互操作区域 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:h-[calc(100vh-500px)] min-h-[600px]">
          {/* 球员列表 */}
          <section className="md:col-span-3 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 font-black text-slate-700 mb-8 px-1">
              <Users className="w-6 h-6 text-indigo-600" />
              <span className="text-lg">活跃球员</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-3 space-y-10">
              {teamsList.map(team => (
                <div key={team} className="space-y-5">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="w-2 h-5 bg-indigo-600 rounded-full"></div>
                    <h3 className="text-sm font-black text-slate-800 tracking-wider uppercase">{team}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {players.filter(p => p.team === team).map(p => (
                      <button 
                        key={p.id} 
                        onClick={() => setSelectedPlayerId(p.id)} 
                        className={`py-5 px-3 rounded-3xl text-sm font-black transition-all truncate border-2 ${selectedPlayerId === p.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-100 scale-[1.05]' : 'bg-slate-50 text-slate-600 border-transparent hover:bg-slate-100 active:scale-95'}`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 打点操作区 */}
          <section className="md:col-span-4 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 font-black text-slate-700 mb-8 px-1">
              <Target className="w-6 h-6 text-rose-500" />
              <span className="text-lg">数据捕获</span>
            </div>
            <div className="space-y-10 flex-1 overflow-y-auto custom-scrollbar pr-2">
              <ActionGroup title="进攻得分 (Scoring)">
                <div className="grid grid-cols-2 gap-4">
                  <StatBtn label="罚球命中" color="emerald" onClick={() => handleRecordStat('FT_MADE')} />
                  <StatBtn label="罚球不中" color="rose" onClick={() => handleRecordStat('FT_MISS')} />
                  <StatBtn label="2分命中" color="emerald" onClick={() => handleRecordStat('2PT_MADE')} />
                  <StatBtn label="2分投失" color="rose" onClick={() => handleRecordStat('2PT_MISS')} />
                  <StatBtn label="3分命中" color="emerald" onClick={() => handleRecordStat('3PT_MADE')} />
                  <StatBtn label="3分投失" color="rose" onClick={() => handleRecordStat('3PT_MISS')} />
                </div>
              </ActionGroup>
              <ActionGroup title="组织篮板 (Utility)">
                <div className="grid grid-cols-2 gap-4">
                  <StatBtn label="进攻篮板" color="amber" onClick={() => handleRecordStat('OFF_REB')} />
                  <StatBtn label="防守篮板" color="amber" onClick={() => handleRecordStat('DEF_REB')} />
                  <StatBtn label="助攻" color="sky" onClick={() => handleRecordStat('ASSIST')} />
                  <StatBtn label="抢断" color="sky" onClick={() => handleRecordStat('STEAL')} />
                  <StatBtn label="盖帽" color="sky" onClick={() => handleRecordStat('BLOCK')} />
                </div>
              </ActionGroup>
              <ActionGroup title="负面记录 (Penalty)">
                <div className="grid grid-cols-2 gap-4">
                  <StatBtn label="失误" color="slate" onClick={() => handleRecordStat('TURNOVER')} />
                  <StatBtn label="犯规" color="rose" onClick={() => handleRecordStat('FOUL')} />
                </div>
              </ActionGroup>
            </div>
          </section>

          {/* 实时分析与日志 */}
          <section className="md:col-span-5 flex flex-col gap-6 overflow-hidden">
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center text-white font-black text-4xl shadow-xl ring-8 ring-slate-50">
                    {selectedPlayer?.name.charAt(0) || '?'}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{selectedPlayer?.name || '选择球员'}</h2>
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mt-1">{selectedPlayer?.team || 'PENDING TEAM'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <ToolBtn icon={<RotateCcw className="w-4 h-4"/>} label="撤销" onClick={handleUndo} color="slate" />
                  <ToolBtn icon={<Trash2 className="w-4 h-4"/>} label="清空" onClick={handleClear} color="rose" />
                </div>
              </div>
              
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 mb-8">
                <SummaryItem label="得分" value={currentPlayerStats?.pts || 0} highlight />
                <SummaryItem label="篮板" value={currentPlayerStats?.reb || 0} />
                <SummaryItem label="助攻" value={currentPlayerStats?.ast || 0} />
                <SummaryItem label="抢断" value={currentPlayerStats?.stl || 0} />
                <SummaryItem label="盖帽" value={currentPlayerStats?.blk || 0} />
                <SummaryItem label="失误" value={currentPlayerStats?.tov || 0} />
                <SummaryItem label="犯规" value={currentPlayerStats?.foul || 0} />
              </div>
              
              <div className="flex gap-4 pt-6 border-t border-slate-100">
                <ToolBtn icon={<Table className="w-4 h-4"/>} label="导出统计表" onClick={exportAsTable} color="indigo" />
                <ToolBtn icon={<LayoutGrid className="w-4 h-4"/>} label="更多视图" onClick={() => alert('更多视图开发中...')} color="slate" />
              </div>
            </div>

            {/* 日志流终端 */}
            <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl flex-1 flex flex-col overflow-hidden border border-slate-800">
              <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-2xl">
                <div className="flex items-center gap-3 text-white font-black tracking-widest uppercase text-xs">
                  <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span>实时打点动态流</span>
                </div>
                <div className="text-[10px] font-black text-slate-500 bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700/50">{history.length} ACTIONS</div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-4 font-mono">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-6 opacity-30">
                    <Trophy className="w-20 h-20" />
                    <p className="text-[10px] uppercase font-black tracking-[0.4em]">Listening for court data...</p>
                  </div>
                ) : (
                  history.map(a => (
                    <div key={a.id} className="flex items-center justify-between bg-slate-800/50 p-6 rounded-3xl border border-slate-800 transition-all hover:bg-slate-800/80 group">
                      <div className="flex flex-wrap items-center gap-y-3 gap-x-8">
                        <span className="text-[10px] font-black text-slate-500">{new Date(a.timestamp).toLocaleTimeString([], { hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit' })}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 uppercase truncate max-w-[120px]">{a.team}</span>
                          <span className="text-sm font-black text-slate-100">{a.playerName}</span>
                        </div>
                        <span className={`text-sm font-black ${a.type.includes('MISS') || a.type === 'TURNOVER' || a.type === 'FOUL' ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {STAT_LABELS[a.type]}
                        </span>
                      </div>
                      <button onClick={() => setHistory(history.filter(h => h.id !== a.id))} className="p-3 opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all rounded-2xl">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

interface SubComponentProps {
  title?: string;
  children?: React.ReactNode;
  label?: string;
  color?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  value?: number;
  highlight?: boolean;
}

const ActionGroup: React.FC<SubComponentProps> = ({ title, children }) => (
  <div className="space-y-4">
    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] px-2">{title}</h4>
    {children}
  </div>
);

const StatBtn: React.FC<SubComponentProps> = ({ label, color, onClick }) => {
  const themes: Record<string, string> = { 
    emerald: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200/50', 
    rose: 'bg-rose-500 hover:bg-rose-600 shadow-rose-200/50', 
    amber: 'bg-amber-500 hover:bg-amber-600 shadow-amber-200/50', 
    sky: 'bg-sky-500 hover:bg-sky-600 shadow-sky-200/50', 
    slate: 'bg-slate-600 hover:bg-slate-700 shadow-slate-200/50' 
  };
  return (
    <button 
      onClick={onClick} 
      className={`w-full py-5 rounded-[1.5rem] text-white text-sm font-black shadow-xl transition-all active:scale-95 touch-manipulation ${themes[color || 'slate']}`}
    >
      {label}
    </button>
  );
};

const ToolBtn: React.FC<SubComponentProps> = ({ icon, label, onClick, color }) => {
  const themes: Record<string, string> = { 
    indigo: 'bg-indigo-600 text-white shadow-2xl shadow-indigo-100 hover:bg-indigo-700', 
    rose: 'bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100', 
    slate: 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200' 
  };
  return (
    <button 
      onClick={onClick} 
      className={`flex-1 md:flex-none px-6 py-4 rounded-2xl flex items-center justify-center gap-3 text-xs font-black transition-all active:scale-95 touch-manipulation ${themes[color || 'slate']}`}
    >
      {icon}
      <span className="hidden sm:inline-block">{label}</span>
    </button>
  );
};

const SummaryItem: React.FC<SubComponentProps> = ({ label, value, highlight }) => (
  <div className={`p-5 rounded-[1.5rem] border text-center transition-all ${highlight ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xl shadow-indigo-100' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
    <div className={`text-[9px] font-black uppercase tracking-widest mb-1 ${highlight ? 'text-indigo-200' : 'text-slate-400'}`}>{label}</div>
    <div className="text-2xl font-black font-mono leading-none tracking-tighter">{value}</div>
  </div>
);

export default App;
