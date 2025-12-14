'use client';

/**
 * Tax Card Component
 * Summary card for a single tax type
 */

import React from 'react';
import { Card, Typography, Space, Tooltip, Statistic } from 'antd';
import {
  HomeOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { DataTypeBadge } from './DataTypeBadge';
import { SourceLink } from './SourceLink';
import { formatRate, formatTaxType } from '@/lib/formatters';
import { colors, getJurisdictionColor } from '@/styles/tokens';
import type { TaxCardSummary, TaxType } from '@/types';

const { Text } = Typography;

// Icons for each tax type
const taxTypeIcons: Record<TaxType, React.ReactNode> = {
  property: <HomeOutlined />,
  sales: <ShoppingCartOutlined />,
  income: <DollarOutlined />,
  payroll: <BankOutlined />,
  corporate: <BankOutlined />,
  excise: <ShoppingCartOutlined />,
  lodging: <HomeOutlined />,
  utility: <BankOutlined />,
  other: <DollarOutlined />,
};

interface TaxCardProps {
  card: TaxCardSummary;
  onClick?: () => void;
}

export function TaxCard({ card, onClick }: TaxCardProps) {
  const icon = taxTypeIcons[card.taxType] || <DollarOutlined />;

  return (
    <Card
      hoverable={!!onClick}
      onClick={onClick}
      style={{ height: '100%' }}
      styles={{
        body: { padding: 16 },
      }}
    >
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {/* Header */}
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <span style={{ fontSize: 20, color: colors.primary }}>{icon}</span>
            <Text strong>{formatTaxType(card.taxType)}</Text>
          </Space>
          <DataTypeBadge dataType={card.dataType} size="small" />
        </Space>

        {/* Rate */}
        <Statistic
          value={card.totalRate ?? undefined}
          formatter={(value) =>
            value !== undefined ? formatRate(value as number, card.rateUnit) : '—'
          }
          valueStyle={{
            fontSize: 28,
            fontWeight: 600,
            color: colors.neutral.text,
          }}
        />

        {/* Jurisdictions count */}
        <Text type="secondary" style={{ fontSize: 12 }}>
          {card.jurisdictionCount} jurisdiction{card.jurisdictionCount !== 1 ? 's' : ''} contribute
        </Text>

        {/* Note */}
        {card.note && (
          <Tooltip title={card.note}>
            <Text
              type="secondary"
              style={{
                fontSize: 11,
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {card.note}
            </Text>
          </Tooltip>
        )}

        {/* Source */}
        <div style={{ marginTop: 'auto' }}>
          <SourceLink source={card.source} size="small" />
        </div>
      </Space>
    </Card>
  );
}
