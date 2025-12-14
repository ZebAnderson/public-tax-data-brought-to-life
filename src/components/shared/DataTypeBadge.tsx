'use client';

/**
 * Data Type Badge Component
 * Shows FACT, ESTIMATE, or SIGNAL indicator
 */

import React from 'react';
import { Tag, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  CalculatorOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { colors } from '@/styles/tokens';
import type { DataType } from '@/types';

interface DataTypeBadgeProps {
  dataType: DataType;
  showLabel?: boolean;
  size?: 'small' | 'default';
}

const config: Record<DataType, { color: string; icon: React.ReactNode; label: string; tooltip: string }> = {
  fact: {
    color: colors.dataType.fact,
    icon: <CheckCircleOutlined />,
    label: 'FACT',
    tooltip: 'Verified data from official sources',
  },
  estimate: {
    color: colors.dataType.estimate,
    icon: <CalculatorOutlined />,
    label: 'ESTIMATE',
    tooltip: 'Calculated or estimated value based on available data',
  },
  signal: {
    color: colors.dataType.signal,
    icon: <BulbOutlined />,
    label: 'SIGNAL',
    tooltip: 'Proposed or pending - not yet enacted',
  },
};

export function DataTypeBadge({
  dataType,
  showLabel = true,
  size = 'default',
}: DataTypeBadgeProps) {
  const conf = config[dataType];

  return (
    <Tooltip title={conf.tooltip}>
      <Tag
        color={conf.color}
        icon={conf.icon}
        style={{
          fontSize: size === 'small' ? 10 : 12,
          padding: size === 'small' ? '0 4px' : undefined,
          margin: 0,
        }}
      >
        {showLabel && conf.label}
      </Tag>
    </Tooltip>
  );
}
