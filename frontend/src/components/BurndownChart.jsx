import React, { useState, useEffect } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area } from 'recharts';
import { fetchBurndown } from '../services/api';

const BurndownChart = ({ sprintId }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sprintId) return;
    loadBurndown();
  }, [sprintId]);

  const loadBurndown = async () => {
    setLoading(true);
    try {
      const result = await fetchBurndown(sprintId);
      // Format dates for display
      const formatted = result.map(point => ({
        ...point,
        label: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }));
      setData(formatted);
    } catch (err) {
      console.error('Failed to load burndown', err);
    } finally {
      setLoading(false);
    }
  };

  if (!sprintId) return null;

  if (loading) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Burndown Chart</h3>
        <div className="h-[200px] flex items-center justify-center text-slate-500 text-xs">Loading...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Burndown Chart</h3>
        <div className="h-[200px] flex items-center justify-center text-slate-500 text-xs">No burndown data yet. Assign tasks to this sprint.</div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-300">Burndown Chart</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-[2px] bg-slate-500" style={{ borderTop: '2px dashed #64748b' }}></div>
            <span className="text-[10px] text-slate-500">Ideal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-[2px] bg-blue-500"></div>
            <span className="text-[10px] text-slate-500">Actual</span>
          </div>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={220}>
        {/* ComposedChart: AreaChart silently drops the <Line> child, hiding the ideal line */}
        <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
          <defs>
            <linearGradient id="burndownGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            unit="h"
            domain={[0, 'auto']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#e2e8f0'
            }}
            formatter={(value, name) => [`${value}h`, name === 'ideal' ? 'Ideal' : 'Actual']}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Line
            type="monotone"
            dataKey="ideal"
            stroke="#475569"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="actual"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#burndownGradient)"
            dot={{ fill: '#3b82f6', r: 2, strokeWidth: 0 }}
            activeDot={{ r: 4, fill: '#3b82f6', stroke: '#1e293b', strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BurndownChart;
