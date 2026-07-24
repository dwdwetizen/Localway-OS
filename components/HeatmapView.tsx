'use client';

import React, { useState } from 'react';
import {
  MapPin,
  Search,
  Sparkles,
  RefreshCw,
  TrendingUp,
  Sliders,
  Maximize2,
  Info,
  CheckCircle2,
  Building2,
  ChevronRight,
  Layers,
} from 'lucide-react';

interface HeatmapViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export function HeatmapView({ onShowToast }: HeatmapViewProps) {
  const [keyword, setKeyword] = useState('Padaria artesanal');
  const [companyName, setCompanyName] = useState('Padaria & Confeitaria Silva');
  const [gridSize, setGridSize] = useState<'3x3' | '5x5' | '7x7'>('5x5');
  const [distance, setDistance] = useState('1.0km');
  const [isScanning, setIsScanning] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ x: number; y: number; rank: number } | null>({
    x: 2,
    y: 2,
    rank: 1,
  });

  // 5x5 Grid positions mock data
  const grid5x5 = [
    [12, 8, 5, 9, 14],
    [7, 3, 2, 4, 11],
    [4, 1, 1, 2, 8],
    [9, 2, 3, 5, 13],
    [15, 11, 7, 10, 18],
  ];

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      onShowToast(`Varredura do mapa concluída para "${keyword}" (${gridSize} • ${distance})!`);
    }, 1200);
  };

  const getRankBadgeClass = (rank: number) => {
    if (rank <= 3) return 'bg-emerald-500 text-white shadow-emerald-500/40 ring-4 ring-emerald-500/20';
    if (rank <= 10) return 'bg-amber-500 text-white shadow-amber-500/40 ring-4 ring-amber-500/20';
    if (rank <= 20) return 'bg-orange-500 text-white shadow-orange-500/40 ring-4 ring-orange-500/20';
    return 'bg-rose-600 text-white shadow-rose-600/40 ring-4 ring-rose-600/20';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0066ff]/10 text-[#0066ff] flex items-center justify-center font-bold">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">
              Mapa de Calor Geográfico (Heatmap)
            </h2>
            <p className="text-xs text-[#727687]">
              Visualização de posicionamento local ponto-a-ponto no Google Maps
            </p>
          </div>
        </div>

        {/* Legend pills */}
        <div className="flex items-center gap-2 text-xs font-semibold flex-wrap">
          <span className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/20">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Rank 1-3 (Top Pack)
          </span>
          <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/20">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Rank 4-10
          </span>
          <span className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-2.5 py-1 rounded-lg border border-rose-500/20">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600" /> Rank 11+
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Control Panel */}
        <div className="bg-white dark:bg-[#141936] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-bold font-poppins text-base text-[#1a1b22] dark:text-[#f8f7ff] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#0066ff]" /> Parâmetros de Varredura
            </h3>

            <div>
              <label className="text-xs font-bold text-[#727687] block mb-1">
                Palavra-chave Alvo (SEO Local):
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#727687]" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] text-[#1a1b22] dark:text-[#f8f7ff] border border-[#c2c6d8]/40 dark:border-[#2e366b] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066ff]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#727687] block mb-1">
                Empresa Analisada:
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] text-[#1a1b22] dark:text-[#f8f7ff] border border-[#c2c6d8]/40 dark:border-[#2e366b] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066ff]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#727687] block mb-1">
                  Tamanho da Grade:
                </label>
                <select
                  value={gridSize}
                  onChange={(e) => setGridSize(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] text-[#1a1b22] dark:text-[#f8f7ff] border border-[#c2c6d8]/40 dark:border-[#2e366b] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066ff]"
                >
                  <option value="3x3">3x3 (9 Pontos)</option>
                  <option value="5x5">5x5 (25 Pontos)</option>
                  <option value="7x7">7x7 (49 Pontos)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#727687] block mb-1">
                  Raio / Passo (Distância):
                </label>
                <select
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] text-[#1a1b22] dark:text-[#f8f7ff] border border-[#c2c6d8]/40 dark:border-[#2e366b] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066ff]"
                >
                  <option value="0.5km">0.5 km (Hiperlocal)</option>
                  <option value="1.0km">1.0 km (Padrão)</option>
                  <option value="2.0km">2.0 km (Regional)</option>
                  <option value="5.0km">5.0 km (Expandido)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleScan}
              disabled={isScanning}
              className="w-full py-3 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Mapeando Coordenadas GPS...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Atualizar Varredura de Mapa
                </>
              )}
            </button>
          </div>

          {/* Trend Summary Box */}
          <div className="pt-4 border-t border-[#c2c6d8]/20 dark:border-[#2e366b] space-y-3">
            <h4 className="text-xs font-bold text-[#727687] uppercase tracking-wider">
              Histórico de Desempenho
            </h4>

            <div className="p-3 bg-[#f4f2fd] dark:bg-[#10142e] rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] text-[#727687] font-semibold">Rank Médio na Região</p>
                <p className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">#4.2</p>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg">
                +3 posições ↑
              </span>
            </div>

            <div className="p-3 bg-[#f4f2fd] dark:bg-[#10142e] rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] text-[#727687] font-semibold">Domínio no Local Pack (Top 3)</p>
                <p className="text-xl font-bold font-poppins text-[#0066ff]">48% do Raio</p>
              </div>
              <span className="text-xs font-bold text-[#0066ff] bg-[#0066ff]/10 px-2.5 py-1 rounded-lg">
                12 de 25 pontos
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Map Visualizer Canvas (2 Cols) */}
        <div className="lg:col-span-2 bg-[#1a1f3a] dark:bg-[#060919] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-inner relative min-h-[460px] flex flex-col justify-between overflow-hidden">
          {/* Simulated Map Background Grid Lines */}
          <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#0066ff_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Top Map Controls Overlay */}
          <div className="relative z-10 flex justify-between items-center text-white/80 text-xs">
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
              <Layers className="w-4 h-4 text-[#0066ff]" />
              <span>Grade 5x5 • Ponto Central: {companyName}</span>
            </div>
            <button
              onClick={() => onShowToast('Visualização expandida do mapa aberta.')}
              className="p-1.5 bg-black/40 hover:bg-black/60 rounded-lg text-white"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Heatmap Grid Marker Points */}
          <div className="relative z-10 my-auto py-6 max-w-md mx-auto w-full">
            <div className="grid grid-cols-5 gap-3 sm:gap-4 justify-items-center">
              {grid5x5.map((row, rIdx) =>
                row.map((rank, cIdx) => {
                  const isSelected = selectedCell?.x === cIdx && selectedCell?.y === rIdx;
                  const isCenter = rIdx === 2 && cIdx === 2;

                  return (
                    <button
                      key={`${rIdx}-${cIdx}`}
                      onClick={() => setSelectedCell({ x: cIdx, y: rIdx, rank })}
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-bold text-xs shadow-lg transition-all transform hover:scale-110 active:scale-95 relative ${getRankBadgeClass(
                        rank
                      )} ${isSelected ? 'ring-4 ring-white dark:ring-[#0066ff] scale-110 z-20' : ''}`}
                    >
                      {rank}
                      {isCenter && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#0066ff] ring-2 ring-white rounded-full flex items-center justify-center text-[8px]">
                          ★
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Bottom Selected Coordinate Detail Card */}
          {selectedCell && (
            <div className="relative z-10 bg-black/70 backdrop-blur-md p-4 rounded-xl border border-white/10 text-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#0066ff] text-white flex items-center justify-center font-bold text-sm shrink-0">
                  #{selectedCell.rank}
                </div>
                <div>
                  <p className="font-bold text-sm text-white">
                    Ponto {selectedCell.x + 1},{selectedCell.y + 1} — Posição #{selectedCell.rank} no Google
                  </p>
                  <p className="text-white/70">
                    {selectedCell.rank <= 3
                      ? 'Empresa está visível no Top 3 (Local Pack) desta área!'
                      : 'Nesta coordenada a empresa perde clientes para concorrentes diretos.'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onShowToast(`Relatório detalhado do ponto ${selectedCell.x + 1},${selectedCell.y + 1} baixado.`)}
                className="px-3 py-2 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold rounded-lg text-xs shrink-0 whitespace-nowrap"
              >
                Analisar Ponto Detalhado
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
