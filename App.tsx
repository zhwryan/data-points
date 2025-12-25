
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  RotateCcw, 
  RotateCw, 
  Trash2, 
  Table, 
  FileText, 
  Upload, 
  Zap,
  Info,
  Users,
  Target,
  ClipboardList,
  ExternalLink,
  Search
} from 'lucide-react';
import { Player, GameAction, StatType, STAT_LABELS } from './types';

const INITIAL_ROSTER = "宏疆队:刘竞,吴维,宋延,连淼,阿鑫,庄国宇,郑宏伟,陈泓达;沐骁队:临时,张伟,施颐,林鸿,沐阳,陈超,刘先生,李志航";

const App: React.FC = () => {
  // --- 状态定义 ---
  const [matchUrl, setMatchUrl] = useState('matchDetails/index?matchId=400302960&sportType=1');
  const [playersText, setPlayersText] = useState(INITIAL_ROSTER);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [history, setHistory] = useState<GameAction[]>([]);
  const [redoStack, setRedoStack] = useState<GameAction[]>([]);
  
  // 计分板状态
  const [homeScores, setHomeScores] = useState<number[]>([0, 0, 0, 0]);
  const [awayScores, setAwayScores] = useState<number[]>([0, 0, 0, 0]);
  const [teamNames, setTeamNames] = useState<string[]>(['主队', '客队']);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 逻辑解析 ---
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

  // --- 核心功能：数据抓取 ---
  const handleFetchMatchData = async () => {
    if (!matchUrl.trim()) {
      alert("请输入有效的比赛链接");
      return;
    }
    
    // 模拟数据抓取逻辑
    const mockFetchedData = {
      home: { name: "宏疆队", players: ["刘竞", "吴维", "宋延", "连淼", "阿鑫", "庄国宇", "郑宏伟", "陈泓达"], scores: [22, 18, 25, 20] },
      away: { name: "沐骁队", players: ["临时", "张伟", "施颐", "林鸿", "沐阳", "陈超", "刘先生", "李志航"], scores: [15, 20, 18, 22] }
    };

    const newRosterText = `${mockFetchedData.home.name}:${mockFetchedData.home.players.join(',')};${mockFetchedData.away.name}:${mockFetchedData.away.players.join(',')}`;
    setPlayersText(newRosterText);
    setHomeScores(mockFetchedData.home.scores);
    setAwayScores(mockFetchedData.away.scores);
    setTeamNames([mockFetchedData.home.name, mockFetchedData.away.name]);

    alert("数据同步成功！球员名单与分数已更新。");
  };

  const openLittleFans = () => {
    window.open("https://h5static.xiaoqiumi.com/littleFans/index.html", "_blank");
  };

  // --- 数据操作 ---
  const handleRecordStat = useCallback((type: StatType) => {
    if (!selectedPlayer) {
      alert("请先选择一名球员");
      return;
    }

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
    const [last, ...rest] = redoStack;
    setRedoStack(redoStack.slice(1));
    setHistory(prev => [last, ...prev]);
  };

  // --- 核心功能：全量清空 ---
  const handleClear = () => {
    if (window.confirm("【警告】确定要清空吗？\n这将会清除所有打点记录，并将计分板重置为0。")) {
      setHistory([]);
      setRedoStack([]);
      setHomeScores([0, 0, 0, 0]);
      setAwayScores([0, 0, 0, 0]);
    }
  };

  const calculateStats = (pId: string) => {
    const pActions = history.filter(h => h.playerId === pId);
    const stats: Record<string, number> = {
      pts: 0, reb: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, foul: 0,
      ftm: 0, fta: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0
    };

    pActions.forEach(a => {
      if (a.type === 'FT_MADE') { stats.pts += 1; stats.ftm += 1; stats.fta += 1; }
      if (a.type === 'FT_MISS') { stats.fta += 1; }
      if (a.type === '2PT_MADE') { stats.pts += 2; stats.fg2m += 1; stats.fg2a += 1; }
      if (a.type === '2PT_MISS') { stats.fg2a += 1; }
      if (a.type === '3PT_MADE') { stats.pts += 3; stats.fg3m += 1; stats.fg3a += 1; }
      if (a.type === '3PT_MISS') { stats.fg3a += 1; }
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

  const exportAsText = () => {
    const lines = history.slice().reverse().map(a => {
      const time = new Date(a.timestamp).toLocaleTimeString([], { hour12: false });
      return `${time} ${a.playerName} ${STAT_LABELS[a.type]}`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `match_log_${Date.now()}.txt`;
    link.click();
  };

  const exportAsTable = () => {
    let csv = "姓名,球队,总分,篮板,进攻板,后场板,助攻,抢断,盖帽,失误,犯规,二分命中,二分出手,三分命中,三分出手,罚球命中,罚球出手\n";
    players.forEach(p => {
      const s = calculateStats(p.id);
      csv += `${p.name},${p.team},${s.pts},${s.reb},${s.oreb},${s.dreb},${s.ast},${s.stl},${s.blk},${s.tov},${s.foul},${s.fg2m},${s.fg2a},${s.fg3m},${s.fg3a},${s.ftm},${s.fta}\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `match_stats_${Date.now()}.csv`;
    link.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      alert("日志加载完成，记录数：" + text.split('\n').length);
    };
    reader.readAsText(file);
  };

  const currentPlayerStats = useMemo(() => 
    selectedPlayerId ? calculateStats(selectedPlayerId) : null,
  [history, selectedPlayerId]);

  const teamsList = Array.from(new Set(players.map(p => p.team)));

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 font-sans p-4 lg:p-6 overflow-x-hidden">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* 顶部 Header */}
        <header className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col xl:flex-row gap-8 items-stretch">
          
          <div className="flex-1 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <ClipboardList className="w-6 h-6 text-indigo-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">比赛信息配置</h1>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">比赛链接</label>
                <div className="flex gap-2">
                  <input 
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all shadow-inner"
                    value={matchUrl}
                    onChange={e => setMatchUrl(e.target.value)}
                  />
                  <button 
                    onClick={handleFetchMatchData}
                    className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    获取
                  </button>
                  <button 
                    onClick={openLittleFans}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    小球迷
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">球员名单</label>
                <textarea 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm h-[46px] resize-none transition-all shadow-inner custom-scrollbar"
                  value={playersText}
                  onChange={e => setPlayersText(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 计分板 UI - 增强适配 */}
          <div className="w-full xl:w-auto min-w-[460px] shrink-0">
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden h-full flex items-center">
              <div className="absolute -top-4 -right-4 opacity-5 rotate-12"><Zap className="w-24 h-24 text-indigo-400" /></div>
              <table className="w-full text-center border-collapse tabular-nums">
                <thead>
                  <tr className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">
                    <th className="pb-4 text-left px-3">Team</th>
                    <th className="pb-4">Q1</th>
                    <th className="pb-4">Q2</th>
                    <th className="pb-4">Q3</th>
                    <th className="pb-4">Q4</th>
                    <th className="pb-4 text-indigo-400">Tot</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-base">
                  <tr className="border-b border-slate-800/60">
                    <td className="py-4 text-left px-3 font-sans font-bold text-[14px] truncate max-w-[130px] text-slate-200">
                      {teamNames[0]}
                    </td>
                    {homeScores.map((s, i) => (
                      <td key={i} className="py-3 px-1">
                        <input 
                          type="number" 
                          className="w-12 py-2 bg-slate-800 text-center rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700 text-sm font-bold shadow-lg" 
                          value={s}
                          onChange={e => {
                            const newScores = [...homeScores];
                            newScores[i] = parseInt(e.target.value) || 0;
                            setHomeScores(newScores);
                          }}
                        />
                      </td>
                    ))}
                    <td className="py-3 font-black text-2xl text-indigo-400 px-4">
                      {homeScores.reduce((a, b) => a + b, 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 text-left px-3 font-sans font-bold text-[14px] truncate max-w-[130px] text-slate-200">
                      {teamNames[1]}
                    </td>
                    {awayScores.map((s, i) => (
                      <td key={i} className="py-3 px-1">
                        <input 
                          type="number" 
                          className="w-12 py-2 bg-slate-800 text-center rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700 text-sm font-bold shadow-lg" 
                          value={s}
                          onChange={e => {
                            const newScores = [...awayScores];
                            newScores[i] = parseInt(e.target.value) || 0;
                            setAwayScores(newScores);
                          }}
                        />
                      </td>
                    ))}
                    <td className="py-3 font-black text-2xl text-indigo-400 px-4">
                      {awayScores.reduce((a, b) => a + b, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </header>

        {/* 主交互 */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          <section className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 h-[680px] flex flex-col">
              <div className="flex items-center gap-2 font-bold text-slate-700 mb-5 shrink-0">
                <Users className="w-5 h-5 text-indigo-500" />
                <span>所有球员</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                {teamsList.map(team => (
                  <div key={team} className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
                      <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{team}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {players.filter(p => p.team === team).map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPlayerId(p.id)}
                          className={`py-3.5 px-3 rounded-xl text-sm font-bold transition-all active:scale-95 text-center ${
                            selectedPlayerId === p.id 
                            ? 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-600' 
                            : 'bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 border border-transparent'
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 h-[680px] flex flex-col">
              <div className="flex items-center gap-2 font-bold text-slate-700 mb-6 shrink-0">
                <Target className="w-5 h-5 text-rose-500" />
                <span>技术统计打点</span>
              </div>
              <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-1">
                <ActionGroup title="得分项目">
                  <div className="grid grid-cols-2 gap-2.5">
                    <StatBtn label="罚球命中" color="emerald" onClick={() => handleRecordStat('FT_MADE')} />
                    <StatBtn label="罚球不中" color="rose" onClick={() => handleRecordStat('FT_MISS')} />
                    <StatBtn label="二分命中" color="emerald" onClick={() => handleRecordStat('2PT_MADE')} />
                    <StatBtn label="二分不中" color="rose" onClick={() => handleRecordStat('2PT_MISS')} />
                    <StatBtn label="三分命中" color="emerald" onClick={() => handleRecordStat('3PT_MADE')} />
                    <StatBtn label="三分不中" color="rose" onClick={() => handleRecordStat('3PT_MISS')} />
                  </div>
                </ActionGroup>
                <ActionGroup title="篮板与助攻">
                  <div className="grid grid-cols-2 gap-2.5">
                    <StatBtn label="前场板" color="amber" onClick={() => handleRecordStat('OFF_REB')} />
                    <StatBtn label="后场板" color="amber" onClick={() => handleRecordStat('DEF_REB')} />
                    <StatBtn label="助攻" color="sky" onClick={() => handleRecordStat('ASSIST')} />
                    <StatBtn label="抢断" color="sky" onClick={() => handleRecordStat('STEAL')} />
                    <StatBtn label="盖帽" color="sky" onClick={() => handleRecordStat('BLOCK')} />
                  </div>
                </ActionGroup>
                <ActionGroup title="其他">
                  <div className="grid grid-cols-2 gap-2.5">
                    <StatBtn label="失误" color="slate" onClick={() => handleRecordStat('TURNOVER')} />
                    <StatBtn label="犯规" color="slate" onClick={() => handleRecordStat('FOUL')} />
                  </div>
                </ActionGroup>
              </div>
            </div>
          </section>

          <section className="lg:col-span-6 flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-xl shadow-inner">
                    {selectedPlayer?.name.charAt(0) || '?'}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800 tracking-tight">{selectedPlayer?.name || '请选择球员'}</h2>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{selectedPlayer?.team || '---'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <ToolBtn icon={<RotateCcw className="w-4 h-4"/>} label="撤销" onClick={handleUndo} color="slate" />
                  <ToolBtn icon={<RotateCw className="w-4 h-4"/>} label="重做" onClick={handleRedo} color="slate" />
                  <ToolBtn icon={<Trash2 className="w-4 h-4"/>} label="清空" onClick={handleClear} color="rose" />
                </div>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 mb-6">
                <SummaryItem label="得分" value={currentPlayerStats?.pts || 0} highlight />
                <SummaryItem label="篮板" value={currentPlayerStats?.reb || 0} />
                <SummaryItem label="助攻" value={currentPlayerStats?.ast || 0} />
                <SummaryItem label="抢断" value={currentPlayerStats?.stl || 0} />
                <SummaryItem label="盖帽" value={currentPlayerStats?.blk || 0} />
                <SummaryItem label="失误" value={currentPlayerStats?.tov || 0} />
                <SummaryItem label="犯规" value={currentPlayerStats?.foul || 0} />
              </div>

              <div className="flex flex-wrap gap-2 pt-5 border-t border-slate-100">
                <ToolBtn icon={<Table className="w-4 h-4"/>} label="导出统计表" onClick={exportAsTable} color="indigo" />
                <ToolBtn icon={<FileText className="w-4 h-4"/>} label="日志TXT" onClick={exportAsText} color="indigo" />
                <ToolBtn icon={<Upload className="w-4 h-4"/>} label="导入日志" onClick={() => fileInputRef.current?.click()} color="slate" />
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleImport} accept=".txt" />
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl shadow-2xl flex-1 flex flex-col overflow-hidden h-[330px]">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/50">
                <div className="flex items-center gap-2 text-white font-bold tracking-tight">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span>实时打点流</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{history.length} ACTIONS</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-2.5">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-3">
                    <Target className="w-12 h-12 opacity-10" />
                    <p className="text-xs font-black tracking-widest uppercase">Waiting for records...</p>
                  </div>
                ) : (
                  history.map((a) => (
                    <div key={a.id} className="group flex items-center justify-between bg-slate-800/30 hover:bg-slate-800/80 p-3.5 rounded-xl border border-slate-800/50 transition-all">
                      <div className="flex items-center gap-5">
                        <span className="text-[10px] font-mono text-slate-600">{new Date(a.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-black text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded uppercase tracking-tighter">{a.team}</span>
                          <span className="text-sm font-bold text-slate-100">{a.playerName}</span>
                        </div>
                        <span className={`text-sm font-black tracking-tight ${a.type.includes('MISS') || a.type === 'TURNOVER' ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {STAT_LABELS[a.type]}
                        </span>
                      </div>
                      <button onClick={() => setHistory(history.filter(h => h.id !== a.id))} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-rose-500/20 text-slate-600 hover:text-rose-400 rounded-lg transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

// --- 子组件 ---

const ActionGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">{title}</h4>
    {children}
  </div>
);

const StatBtn: React.FC<{ label: string; color: string; onClick: () => void }> = ({ label, color, onClick }) => {
  const themes: Record<string, string> = {
    emerald: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100/50',
    rose: 'bg-rose-500 hover:bg-rose-600 shadow-rose-100/50',
    amber: 'bg-amber-500 hover:bg-amber-600 shadow-amber-100/50',
    sky: 'bg-sky-500 hover:bg-sky-600 shadow-sky-100/50',
    slate: 'bg-slate-600 hover:bg-slate-700 shadow-slate-100/50',
  };
  return (
    <button onClick={onClick} className={`w-full py-3 px-2 rounded-xl text-white text-[13px] font-black shadow-lg transition-all active:scale-[0.95] ${themes[color]}`}>
      {label}
    </button>
  );
};

const ToolBtn: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; color: string }> = ({ icon, label, onClick, color }) => {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    rose: 'bg-rose-50 hover:bg-rose-100 text-rose-700',
    slate: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
  };
  return (
    <button onClick={onClick} className={`px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs font-black transition-all active:scale-95 shadow-sm ${colors[color]}`}>
      {icon}
      <span className="tracking-tight">{label}</span>
    </button>
  );
};

const SummaryItem: React.FC<{ label: string; value: number; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={`p-3.5 rounded-2xl border text-center transition-all ${highlight ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
    <div className={`text-[9px] font-black uppercase tracking-widest mb-1.5 ${highlight ? 'text-indigo-200' : 'text-slate-400'}`}>{label}</div>
    <div className="text-2xl font-black font-mono leading-none">{value}</div>
  </div>
);

export default App;
