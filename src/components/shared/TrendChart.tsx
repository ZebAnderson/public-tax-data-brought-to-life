'use client';

/**
 * Trend Chart Component
 * Simple line chart for tax rate trends
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, Typography, Space, Empty } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import { colors } from '@/styles/tokens';
import { formatRate, formatPercent } from '@/lib/formatters';

const { Text } = Typography;

interface TrendDataPoint {
  year: number;
  totalRate: number;
}

interface TrendChartProps {
  data: TrendDataPoint[];
  title?: string;
  rateUnit?: string;
  changePercent?: number | null;
  changeDirection?: 'up' | 'down' | 'stable' | null;
  height?: number;
  color?: string;
}

export function TrendChart({
  data,
  title,
  rateUnit = 'percent',
  changePercent,
  changeDirection,
  height = 200,
  color = colors.primary,
}: TrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card style={{ height }}>
        <Empty
          description="No trend data available"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  // Sort by year
  const sortedData = [...data].sort((a, b) => a.year - b.year);

  // Calculate min/max for Y axis
  const rates = sortedData.map((d) => d.totalRate);
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  const padding = (maxRate - minRate) * 0.1 || 0.1;

  // Change indicator
  const ChangeIcon =
    changeDirection === 'up'
      ? ArrowUpOutlined
      : changeDirection === 'down'
      ? ArrowDownOutlined
      : MinusOutlined;

  const changeColor =
    changeDirection === 'up'
      ? colors.impact.increase
      : changeDirection === 'down'
      ? colors.impact.decrease
      : colors.impact.neutral;

  return (
    <Card
      size="small"
      title={title}
      extra={
        changePercent !== null && changePercent !== undefined && (
          <Space size={4}>
            <ChangeIcon style={{ color: changeColor }} />
            <Text style={{ color: changeColor }}>
              {formatPercent(Math.abs(changePercent))}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              ({sortedData[0]?.year}–{sortedData[sortedData.length - 1]?.year})
            </Text>
          </Space>
        )
      }
      styles={{ body: { padding: '12px 8px' } }}
    >
      <ResponsiveContainer width="100%" height={height - 60}>
        <LineChart
          data={sortedData}
          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.neutral.borderSecondary} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: colors.neutral.border }}
          />
          <YAxis
            domain={[minRate - padding, maxRate + padding]}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: colors.neutral.border }}
            tickFormatter={(value) => formatRate(value, rateUnit)}
            width={50}
          />
          <Tooltip
            formatter={(value: number) => [formatRate(value, rateUnit), 'Rate']}
            labelFormatter={(label) => `Year: ${label}`}
            contentStyle={{
              background: colors.neutral.bgContainer,
              border: `1px solid ${colors.neutral.border}`,
              borderRadius: 6,
            }}
          />
          <Line
            type="monotone"
            dataKey="totalRate"
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, fill: color }}
          />
          {/* Reference line at first year value */}
          {sortedData.length > 1 && (
            <ReferenceLine
              y={sortedData[0].totalRate}
              stroke={colors.neutral.border}
              strokeDasharray="5 5"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
