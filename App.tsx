import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  RotateCcw,
  RotateCw,
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
  LayoutGrid,
  GitMerge,
  Upload,
  Download,
  Save
} from 'lucide-react';
import { MatchDataService } from './services/matchDataService';
import { Player, GameAction, StatType, STAT_LABELS } from './types';

const INITIAL_ROSTER = "球队1:队长名,队员1,队员2;球队2:队长名,队员3,队员4";

const App: React.FC = () => {
  // --- 状态定义 ---
  // 使用 localStorage 持久化存储 matchUrl 和 playersText
  const [matchUrl, setMatchUrl] = useState(() => localStorage.getItem('match_url') || '400302960');
  const [playersText, setPlayersText] = useState(() => localStorage.getItem('players_text') || INITIAL_ROSTER);

  // 监听变化并写入 localStorage
  useEffect(() => {
    localStorage.setItem('match_url', matchUrl);
  }, [matchUrl]);

  useEffect(() => {
    localStorage.setItem('players_text', playersText);
  }, [playersText]);

  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [history, setHistory] = useState<GameAction[]>([]);
  const [redoStack, setRedoStack] = useState<GameAction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [groundingSources, setGroundingSources] = useState<{ title: string, uri: string }[]>([]);

  // 计分板状态
  const [homeScores, setHomeScores] = useState<number[]>([26, 34, 30, 30]);
  const [awayScores, setAwayScores] = useState<number[]>([30, 25, 31, 30]);
  const [homeTotal, setHomeTotal] = useState<number | undefined>(undefined);
  const [awayTotal, setAwayTotal] = useState<number | undefined>(undefined);
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

  // --- 核心功能：使用直接 URL 抓取 ---
  const matchService = useMemo(() => new MatchDataService(), []);

  const handleFetchMatchData = async () => {
    if (!matchUrl) return alert("请输入有效链接或 MatchId");

    setIsLoading(true);
    setGroundingSources([]);

    try {
      const { data, sources } = await matchService.fetchMatchData(matchUrl);

      if (data.home && data.away) {
        setTeamNames([data.home.name, data.away.name]);
        setHomeScores(data.home.scores);
        setAwayScores(data.away.scores);
        setHomeTotal(data.home.total);
        setAwayTotal(data.away.total);

        const homePlayers = Array.isArray(data.home.players) ? data.home.players.join(',') : data.home.players;
        const awayPlayers = Array.isArray(data.away.players) ? data.away.players.join(',') : data.away.players;

        setPlayersText(`${data.home.name}:${homePlayers};${data.away.name}:${awayPlayers}`);
        setGroundingSources(sources);
        alert(`同步成功！来自 [${data.home.name} VS ${data.away.name}] 的实时数据。`);
      }
    } catch (error: any) {
      console.error(error);
      alert(`同步失败：${error.message || "未知错误"}`);
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

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const [next, ...rest] = redoStack;
    setRedoStack(rest);
    setHistory(prev => [next, ...prev]);
  };

  const handleClear = () => {
    if (window.confirm("确定要清空所有记录吗？")) {
      setHistory([]);
      setRedoStack([]);
    }
  };

  const handleMerge = () => {
    alert("合并功能需要后端支持或文件系统访问，当前Web版本暂不支持。");
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

  const calculateTeamScore = (teamName: string) => {
    // Calculate score from history for live tracking
    const teamActions = history.filter(h => h.team === teamName);
    let pts = 0;
    teamActions.forEach(a => {
      if (a.type === 'FT_MADE') pts += 1;
      if (a.type === '2PT_MADE') pts += 2;
      if (a.type === '3PT_MADE') pts += 3;
    });
    return pts;
  };

  const exportAsTable = () => {
    // Column headers matching the reference Excel format
    let csv = "姓名,得分,篮板,前场板,后场板,助攻,盖帽,抢断,失误,投篮,3分,罚球,球队\n";
    players.forEach(p => {
      const s = calculateStats(p.id);
      // Calculate shooting stats in "Made-Attempted" format
      const fgMade = s.fg2m + s.fg3m;
      const fgAtt = s.fg2a + s.fg3a;

      csv += `${p.name},${s.pts},${s.reb},${s.oreb},${s.dreb},${s.ast},${s.blk},${s.stl},${s.tov},${fgMade}-${fgAtt},${s.fg3m}-${s.fg3a},${s.ftm}-${s.fta},${p.team}\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `basketball_stats_${Date.now()}.csv`;
    link.click();
  };

  const exportAsText = () => {
    const text = JSON.stringify(history, null, 2);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `match_events_${Date.now()}.json`;
    link.click();
  };

  const handleImportText = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const json = JSON.parse(event.target?.result as string);
            if (Array.isArray(json)) {
              setHistory(json);
              alert("导入成功！");
            } else {
              alert("文件格式不正确");
            }
          } catch (err) {
            alert("解析文件失败");
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const currentPlayerStats = useMemo(() => selectedPlayerId ? calculateStats(selectedPlayerId) : null, [history, selectedPlayerId]);
  const teamsList = Array.from(new Set(players.map(p => p.team)));

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans p-2 md:p-4">
      <div className="max-w-[1440px] mx-auto space-y-4">

        {/* 顶部区域：配置与比分 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* 左侧：输入控制 */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-400" />
                <h2 className="font-bold text-slate-700">比赛信息</h2>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 w-16">比赛链接:</span>
                <input
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 transition-all"
                  value={matchUrl}
                  onChange={e => setMatchUrl(e.target.value)}
                  placeholder="粘贴 URL 或输入 MatchID"
                />
                <button
                  onClick={handleFetchMatchData}
                  disabled={isLoading}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm font-bold hover:bg-slate-700 transition-all disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "获取"}
                </button>
                <button
                  onClick={() => window.open("https://h5static.xiaoqiumi.com/littleFans/index.html", "_blank")}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm font-bold hover:bg-slate-700 transition-all"
                >
                  小球迷
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 w-16">球员名单:</span>
                <input
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 transition-all"
                  value={playersText}
                  onChange={e => setPlayersText(e.target.value)}
                  placeholder="球队A:队员1,队员2;球队B:队员3,队员4"
                />
              </div>
            </div>

            {/* 右侧：比分板 */}
            <div className="lg:w-[500px] bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="grid grid-cols-6 gap-2 text-center text-xs font-bold text-slate-500 mb-2">
                <div className="text-left pl-2">球队</div>
                <div>一节</div>
                <div>二节</div>
                <div>三节</div>
                <div>四节</div>
                <div>总分</div>
              </div>
              {[0, 1].map(idx => {
                const scores = idx === 0 ? homeScores : awayScores;
                const totalState = idx === 0 ? homeTotal : awayTotal;
                const total = totalState !== undefined ? totalState : scores.reduce((a, b) => a + b, 0);
                return (
                  <div key={idx} className="grid grid-cols-6 gap-2 items-center text-center py-2 border-t border-slate-200/50">
                    <div className="text-left pl-2 font-black text-slate-700 truncate">{teamNames[idx]}</div>
                    {scores.map((s, i) => (
                      <div key={i} className="text-slate-600 font-mono">{s}</div>
                    ))}
                    <div className="font-black text-indigo-600 text-lg">{total}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 主体区域：三列布局 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[calc(100vh-220px)] min-h-[600px]">

          {/* 左列：球员选择 */}
          <section className="md:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 font-bold text-slate-700 mb-4">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>球员</span>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
              {teamsList.map(team => (
                <div key={team} className="space-y-3">
                  <div className="flex items-center justify-between border-l-4 border-indigo-600 pl-3 bg-indigo-50/50 py-1 rounded-r-lg">
                    <h3 className="text-sm font-black text-slate-800">{team}</h3>
                    <span className="text-xs font-bold text-indigo-600 px-2">{calculateTeamScore(team)}分</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {players.filter(p => p.team === team).map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPlayerId(p.id)}
                        className={`py-3 px-2 rounded-lg text-sm font-bold transition-all truncate border ${selectedPlayerId === p.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'}`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 中列：快速操作 (垂直列表) */}
          <section className="md:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col">
            <div className="flex items-center gap-2 font-bold text-slate-700 mb-4">
              <Target className="w-5 h-5 text-rose-500" />
              <span>快速操作</span>
            </div>
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="flex flex-col gap-3">
                <StatBtn label="罚球命中" color="emerald" onClick={() => handleRecordStat('FT_MADE')} />
                <StatBtn label="罚球不中" color="rose" onClick={() => handleRecordStat('FT_MISS')} />
                <StatBtn label="两分命中" color="emerald" onClick={() => handleRecordStat('2PT_MADE')} />
                <StatBtn label="两分不中" color="rose" onClick={() => handleRecordStat('2PT_MISS')} />
                <StatBtn label="三分命中" color="emerald" onClick={() => handleRecordStat('3PT_MADE')} />
                <StatBtn label="三分不中" color="rose" onClick={() => handleRecordStat('3PT_MISS')} />
                <StatBtn label="防守篮板" color="emerald" onClick={() => handleRecordStat('DEF_REB')} />
                <StatBtn label="进攻篮板" color="emerald" onClick={() => handleRecordStat('OFF_REB')} />
                <StatBtn label="助攻" color="emerald" onClick={() => handleRecordStat('ASSIST')} />
                <StatBtn label="抢断" color="emerald" onClick={() => handleRecordStat('STEAL')} />
                <StatBtn label="盖帽" color="emerald" onClick={() => handleRecordStat('BLOCK')} />
                <StatBtn label="失误" color="rose" onClick={() => handleRecordStat('TURNOVER')} />
              </div>
            </div>
          </section>

          {/* 右列：操作与日志 */}
          <section className="md:col-span-6 flex flex-col gap-4 overflow-hidden">

            {/* 工具栏 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 shrink-0">
              <div className="flex items-center gap-2 font-bold text-slate-700 mb-4">
                <ClipboardList className="w-5 h-5 text-amber-500" />
                <span>操作与日志</span>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-2">
                <ToolBtn icon={<RotateCcw className="w-4 h-4" />} label="撤销" onClick={handleUndo} color="slate" />
                <ToolBtn icon={<RotateCw className="w-4 h-4" />} label="重做" onClick={handleRedo} color="slate" />
                <ToolBtn icon={<Trash2 className="w-4 h-4" />} label="清空" onClick={handleClear} color="slate" />
                <ToolBtn icon={<GitMerge className="w-4 h-4" />} label="合并" onClick={handleMerge} color="indigo" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <ToolBtn icon={<Table className="w-4 h-4" />} label="导出表格" onClick={exportAsTable} color="slate" />
                <ToolBtn icon={<FileText className="w-4 h-4" />} label="导出文本" onClick={exportAsText} color="slate" />
                <ToolBtn icon={<Upload className="w-4 h-4" />} label="导入文本" onClick={handleImportText} color="slate" />
                <ToolBtn icon={<Download className="w-4 h-4" />} label="一键导出" onClick={exportAsText} color="rose" />
              </div>
            </div>

            {/* 统计面板 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 shrink-0">
              <div className="mb-4 text-center">
                <h3 className="font-black text-xl text-indigo-600">
                  {selectedPlayer ? `${selectedPlayer.name} <${selectedPlayer.team}>` : '请选择球员'}
                </h3>
              </div>
              <div className="grid grid-cols-5 gap-y-4 gap-x-2 text-center">
                <MiniStat label="罚球命中" value={currentPlayerStats?.ftm} />
                <MiniStat label="二分命中" value={currentPlayerStats?.fg2m} />
                <MiniStat label="三分命中" value={currentPlayerStats?.fg3m} />
                <MiniStat label="罚球不中" value={currentPlayerStats?.fta ? currentPlayerStats.fta - currentPlayerStats.ftm : 0} />
                <MiniStat label="两分不中" value={currentPlayerStats?.fg2a ? currentPlayerStats.fg2a - currentPlayerStats.fg2m : 0} />

                <MiniStat label="三分不中" value={currentPlayerStats?.fg3a ? currentPlayerStats.fg3a - currentPlayerStats.fg3m : 0} />
                <MiniStat label="防守篮板" value={currentPlayerStats?.dreb} />
                <MiniStat label="进攻篮板" value={currentPlayerStats?.oreb} />
                <MiniStat label="助攻" value={currentPlayerStats?.ast} />
                <MiniStat label="抢断" value={currentPlayerStats?.stl} />

                <MiniStat label="盖帽" value={currentPlayerStats?.blk} />
                <MiniStat label="失误" value={currentPlayerStats?.tov} />
                <MiniStat label="篮板" value={currentPlayerStats?.reb} />
                <MiniStat label="总分" value={currentPlayerStats?.pts} highlight />
              </div>
            </div>

            {/* 日志流 */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <span className="text-xs font-bold text-slate-500">日志 ({history.length})</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50/50">
                {history.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-300 text-xs">暂无记录</div>
                ) : (
                  history.map(a => (
                    <div key={a.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-100 shadow-sm text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 font-mono">{new Date(a.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <span className="font-bold text-slate-700 w-16 truncate">{a.playerName}</span>
                        <span className={`font-bold ${a.type.includes('MISS') || a.type === 'TURNOVER' || a.type === 'FOUL' ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {STAT_LABELS[a.type]}
                        </span>
                      </div>
                      <button onClick={() => setHistory(history.filter(h => h.id !== a.id))} className="text-slate-300 hover:text-rose-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
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

const StatBtn: React.FC<SubComponentProps> = ({ label, color, onClick }) => {
  const themes: Record<string, string> = {
    emerald: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-200',
    rose: 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200',
    amber: 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200',
    sky: 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-200',
    slate: 'bg-slate-600 hover:bg-slate-700 text-white shadow-slate-200'
  };
  return (
    <button
      onClick={onClick}
      className={`w-full py-3 rounded-xl text-sm font-black shadow-md transition-all active:scale-95 ${themes[color || 'slate']}`}
    >
      {label}
    </button>
  );
};

const ToolBtn: React.FC<SubComponentProps> = ({ icon, label, onClick, color }) => {
  const themes: Record<string, string> = {
    indigo: 'bg-slate-700 text-white hover:bg-slate-800', // Merge style in image looks dark
    rose: 'bg-rose-500 text-white hover:bg-rose-600', // One-click export style
    slate: 'bg-slate-500 text-white hover:bg-slate-600' // Default gray style
  };
  // Adjust colors to match image closer if needed, image has dark gray buttons
  const finalClass = color === 'rose' ? themes.rose : (color === 'indigo' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-500 text-white hover:bg-slate-600');

  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 text-[10px] md:text-xs font-bold transition-all active:scale-95 ${finalClass}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

const MiniStat: React.FC<SubComponentProps> = ({ label, value, highlight }) => (
  <div className="flex flex-col items-center">
    <span className="text-[10px] text-slate-400 mb-1">{label}</span>
    <span className={`text-lg font-black ${highlight ? 'text-indigo-600' : 'text-slate-800'}`}>{value || 0}</span>
  </div>
);

export default App;
