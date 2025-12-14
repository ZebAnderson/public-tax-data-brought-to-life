'use client';

/**
 * Impact Badge Component
 * Shows tax impact direction (increase/decrease/neutral)
 */

import React from 'react';
import { Tag, Tooltip } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import { colors } from '@/styles/tokens';
import { formatImpactDirection, formatCurrency, formatRate } from '@/lib/formatters';
import type { ImpactDirection } from '@/types';

interface ImpactBadgeProps {
  direction: ImpactDirection;
  deltaRate?: number | null;
  deltaRevenue?: number | null;
  description?: string | null;
}

export function ImpactBadge({
  direction,
  deltaRate,
  deltaRevenue,
  description,
}: ImpactBadgeProps) {
  const config: Record<
    ImpactDirection,
    { color: string; icon: React.ReactNode; prefix: string }
  > = {
    increase: {
      color: colors.impact.increase,
      icon: <ArrowUpOutlined />,
      prefix: '+',
    },
    decrease: {
      color: colors.impact.decrease,
      icon: <ArrowDownOutlined />,
      prefix: '-',
    },
    no_change: {
      color: colors.impact.neutral,
      icon: <MinusOutlined />,
      prefix: '',
    },
    restructure: {
      color: colors.impact.neutral,
      icon: <MinusOutlined />,
      prefix: '',
    },
    unknown: {
      color: colors.impact.neutral,
      icon: <MinusOutlined />,
      prefix: '',
    },
  };

  const conf = config[direction];

  // Build tooltip content
  let tooltipContent = description || formatImpactDirection(direction);
  if (deltaRate) {
    tooltipContent += ` | Rate: ${conf.prefix}${formatRate(Math.abs(deltaRate))}`;
  }
  if (deltaRevenue) {
    tooltipContent += ` | Revenue: ${conf.prefix}${formatCurrency(Math.abs(deltaRevenue), { compact: true })}`;
  }

  // Build display text
  let displayText = formatImpactDirection(direction);
  if (deltaRate) {
    displayText = `${conf.prefix}${formatRate(Math.abs(deltaRate))}`;
  }

  return (
    <Tooltip title={tooltipContent}>
      <Tag color={conf.color} icon={conf.icon} style={{ margin: 0 }}>
        {displayText}
      </Tag>
    </Tooltip>
  );
}
