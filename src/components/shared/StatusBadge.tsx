'use client';

/**
 * Status Badge Component
 * Shows policy signal status
 */

import React from 'react';
import { Tag, Tooltip } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/styles/tokens';
import { formatSignalStatus } from '@/lib/formatters';
import type { PolicySignalStatus } from '@/types';

interface StatusBadgeProps {
  status: PolicySignalStatus;
}

const config: Record<
  PolicySignalStatus,
  { color: string; icon: React.ReactNode }
> = {
  proposed: {
    color: colors.status.proposed,
    icon: <ExclamationCircleOutlined />,
  },
  pending: {
    color: colors.status.pending,
    icon: <ClockCircleOutlined />,
  },
  enacted: {
    color: colors.status.enacted,
    icon: <CheckCircleOutlined />,
  },
  withdrawn: {
    color: colors.status.withdrawn,
    icon: <CloseCircleOutlined />,
  },
  expired: {
    color: colors.status.expired,
    icon: <CloseCircleOutlined />,
  },
  unknown: {
    color: colors.status.unknown,
    icon: <ExclamationCircleOutlined />,
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const conf = config[status] || config.pending;

  return (
    <Tooltip title={`Status: ${formatSignalStatus(status)}`}>
      <Tag color={conf.color} icon={conf.icon} style={{ margin: 0 }}>
        {formatSignalStatus(status)}
      </Tag>
    </Tooltip>
  );
}
