'use client';

import { useMemo } from 'react';
import { BarChart3, TrendingUp, AlertTriangle } from 'lucide-react';

interface StatisticalVisualizationProps {
  distribution: Record<string, number>;
  benfordScore: number;
  alerts: Array<{
    severity: 'critical' | 'warning' | 'info';
    type: string;
    message: string;
  }>;
}

const BENFORD_EXPECTED: Record<string, number> = {
  '1': 0.301,
  '2': 0.176,
  '3': 0.125,
  '4': 0.097,
  '5': 0.079,
  '6': 0.067,
  '7': 0.058,
  '8': 0.051,
  '9': 0.046
};

export function StatisticalVisualization({ distribution, benfordScore, alerts }: StatisticalVisualizationProps) {
  const digits = useMemo(() => ['1', '2', '3', '4', '5', '6', '7', '8', '9'], []);
  
  const maxHeight = 100; // pixels
  
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
  const warningAlerts = alerts.filter(a => a.severity === 'warning').length;

  return (
    <div className="space-y-4">
      {/* Alerts Summary */}
      {alerts.length > 0 && (
        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-amber-400">
              {criticalAlerts} Critical, {warningAlerts} Warnings
            </span>
          </div>
          <div className="space-y-1">
            {alerts.slice(0, 3).map((alert, idx) => (
              <div key={idx} className="text-xs text-slate-300">
                <span className={`font-semibold ${
                  alert.severity === 'critical' ? 'text-red-400' : 
                  alert.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'
                }`}>
                  [{alert.severity.toUpperCase()}]
                </span> {alert.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Benford Distribution Histogram */}
      <div className="bg-gradient-to-br from-slate-900/60 to-slate-800/60 border border-slate-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-bold text-slate-300">First Digit Distribution</span>
          </div>
          <div className={`text-xs font-bold px-2 py-1 rounded ${
            benfordScore >= 0.85 ? 'bg-green-500/20 text-green-400' :
            benfordScore >= 0.70 ? 'bg-amber-500/20 text-amber-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            {(benfordScore * 100).toFixed(1)}% Match
          </div>
        </div>
        
        <div className="flex items-end justify-between gap-2 h-32">
          {digits.map(digit => {
            const observed = (distribution[digit] || 0) * 100;
            const expected = (BENFORD_EXPECTED[digit] || 0) * 100;
            const observedHeight = (observed / 35) * maxHeight; // 35% is roughly max expected
            const expectedHeight = (expected / 35) * maxHeight;
            
            return (
              <div key={digit} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center gap-1">
                  {/* Observed bar */}
                  <div 
                    className="w-full bg-gradient-to-t from-blue-500 to-cyan-400 rounded-t transition-all duration-300"
                    style={{ height: `${observedHeight}px` }}
                    title={`Observed: ${observed.toFixed(1)}%`}
                  />
                  {/* Expected marker */}
                  <div 
                    className="w-full h-0.5 bg-amber-400/60"
                    style={{ marginTop: `-${expectedHeight + 2}px` }}
                    title={`Expected: ${expected.toFixed(1)}%`}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-400">{digit}</span>
              </div>
            );
          })}
        </div>
        
        <div className="flex items-center justify-center gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gradient-to-t from-blue-500 to-cyan-400 rounded" />
            <span className="text-slate-400">Observed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-amber-400" />
            <span className="text-slate-400">Expected (Benford)</span>
          </div>
        </div>
      </div>

      {/* Statistical Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Benford Score</div>
          <div className="text-lg font-black text-blue-400">{(benfordScore * 100).toFixed(1)}%</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Data Points</div>
          <div className="text-lg font-black text-purple-400">
            {Object.values(distribution).reduce((sum, val) => sum + val, 0) > 0 ? 
              Math.round(Object.values(distribution).reduce((sum, val) => sum + val, 0) * 100) : 0}
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Anomalies</div>
          <div className="text-lg font-black text-amber-400">{alerts.length}</div>
        </div>
      </div>
    </div>
  );
}
