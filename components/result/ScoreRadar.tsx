"use client";

import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from 'next-themes';

interface ScoreRadarProps {
  data: any[];
}

const ScoreRadar: React.FC<ScoreRadarProps> = ({ data }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke={isDark ? "#4b5563" : "#e5e7eb"} />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: isDark ? '#d1d5db' : '#4b5563', fontSize: 10, fontWeight: 600 }} 
          />
          <PolarRadiusAxis 
            angle={30} 
            domain={[0, 100]} 
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Score"
            dataKey="A"
            stroke={isDark ? "#22c55e" : "#059669"}
            fill={isDark ? "#22c55e" : "#059669"}
            fillOpacity={0.4}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ScoreRadar;
