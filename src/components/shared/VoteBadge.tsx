'use client';

/**
 * Vote Badge Component
 * Shows vote value (yes/no/abstain/absent)
 */

import React from 'react';
import { Tag, Tooltip } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  MinusOutlined,
  UserDeleteOutlined,
} from '@ant-design/icons';
import { colors } from '@/styles/tokens';
import { formatVoteValue } from '@/lib/formatters';
import type { VoteValue } from '@/types';

interface VoteBadgeProps {
  vote: VoteValue;
  showLabel?: boolean;
  size?: 'small' | 'default';
}

const config: Record<
  VoteValue,
  { color: string; icon: React.ReactNode }
> = {
  yes: {
    color: colors.vote.yes,
    icon: <CheckOutlined />,
  },
  no: {
    color: colors.vote.no,
    icon: <CloseOutlined />,
  },
  abstain: {
    color: colors.vote.abstain,
    icon: <MinusOutlined />,
  },
  absent: {
    color: colors.vote.absent,
    icon: <UserDeleteOutlined />,
  },
  present: {
    color: colors.vote.abstain,
    icon: <CheckOutlined />,
  },
  other: {
    color: colors.vote.abstain,
    icon: <MinusOutlined />,
  },
};

export function VoteBadge({ vote, showLabel = true, size = 'default' }: VoteBadgeProps) {
  const conf = config[vote] || config.abstain;

  return (
    <Tooltip title={formatVoteValue(vote)}>
      <Tag
        color={conf.color}
        icon={conf.icon}
        style={{
          margin: 0,
          fontSize: size === 'small' ? 10 : 12,
          padding: size === 'small' ? '0 4px' : undefined,
        }}
      >
        {showLabel && formatVoteValue(vote)}
      </Tag>
    </Tooltip>
  );
}
