'use client';

/**
 * Pending Tab Component
 * Policy signals with status badges and sources
 */

import React from 'react';
import {
  Card,
  Typography,
  Space,
  List,
  Alert,
  Skeleton,
  Empty,
  Tag,
  Descriptions,
} from 'antd';
import {
  ClockCircleOutlined,
  CalendarOutlined,
  WarningOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { usePending } from '@/hooks/use-api';
import {
  StatusBadge,
  DataTypeBadge,
  JurisdictionTag,
  SourceLink,
} from '@/components/shared';
import {
  formatDate,
  formatTaxType,
  formatSignalType,
  formatRelativeDate,
} from '@/lib/formatters';
import { colors } from '@/styles/tokens';
import type { PolicySignalDetail } from '@/types';

const { Title, Text, Paragraph } = Typography;

interface PendingTabProps {
  geoUnitId: string;
}

export function PendingTab({ geoUnitId }: PendingTabProps) {
  const { data, isLoading, error } = usePending({
    geoUnitId,
    enabled: !!geoUnitId,
  });

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="Error Loading Pending Items"
          description={error.message}
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Disclaimer Banner */}
        {data?.disclaimer && (
          <Alert
            message={
              <Space>
                <WarningOutlined />
                <strong>Important</strong>
              </Space>
            }
            description={data.disclaimer}
            type="warning"
            showIcon={false}
            style={{
              background: `${colors.dataType.signal}15`,
              border: `1px solid ${colors.dataType.signal}`,
            }}
          />
        )}

        {/* Last Checked */}
        <Text type="secondary" style={{ fontSize: 12 }}>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          Last checked: {formatRelativeDate(data?.lastChecked ?? '')}
        </Text>

        {/* Policy Signals List */}
        {!data?.items || data.items.length === 0 ? (
          <Card>
            <Empty
              description="No pending items found"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </Card>
        ) : (
          <List
            dataSource={data.items}
            renderItem={(item) => <PolicySignalCard signal={item} />}
            split={false}
          />
        )}
      </Space>
    </div>
  );
}

// Policy Signal Card
function PolicySignalCard({ signal }: { signal: PolicySignalDetail }) {
  return (
    <Card style={{ marginBottom: 16 }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Header */}
        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space wrap>
            <StatusBadge status={signal.status} />
            <DataTypeBadge dataType={signal.dataType} />
            <JurisdictionTag
              type={signal.jurisdictionType}
              name={signal.jurisdictionName}
            />
            {signal.taxType && (
              <Tag color="default">{formatTaxType(signal.taxType)}</Tag>
            )}
          </Space>
          <SourceLink source={signal.source} />
        </Space>

        {/* Title */}
        <Title level={5} style={{ marginBottom: 0 }}>
          {signal.title}
        </Title>

        {/* Summary */}
        {signal.summary && (
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {signal.summary}
          </Paragraph>
        )}

        {/* Details */}
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item
            label={
              <Space>
                <FileTextOutlined />
                <span>Type</span>
              </Space>
            }
          >
            {formatSignalType(signal.details.type)}
          </Descriptions.Item>

          {signal.details.phase && (
            <Descriptions.Item label="Phase">
              <Tag>{signal.details.phase}</Tag>
            </Descriptions.Item>
          )}

          {signal.details.deadline && (
            <Descriptions.Item
              label={
                <Space>
                  <CalendarOutlined />
                  <span>Deadline</span>
                </Space>
              }
            >
              <Text
                type={
                  new Date(signal.details.deadline) < new Date()
                    ? 'danger'
                    : undefined
                }
              >
                {formatDate(signal.details.deadline)}
              </Text>
            </Descriptions.Item>
          )}

          {signal.details.electionDate && (
            <Descriptions.Item label="Election Date">
              {formatDate(signal.details.electionDate)}
            </Descriptions.Item>
          )}

          {signal.details.billNumber && (
            <Descriptions.Item label="Bill Number">
              <Text code>{signal.details.billNumber}</Text>
            </Descriptions.Item>
          )}

          {signal.instrumentName && (
            <Descriptions.Item label="Affects">
              {signal.instrumentName}
            </Descriptions.Item>
          )}
        </Descriptions>

        {/* Potential Impact */}
        {signal.details.potentialImpact && (
          <Card
            size="small"
            style={{
              background: `${colors.dataType.signal}08`,
              border: `1px solid ${colors.dataType.signal}30`,
            }}
          >
            <Space direction="vertical" size={4}>
              <Text strong style={{ fontSize: 12, color: colors.dataType.signal }}>
                Potential Impact
              </Text>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {signal.details.potentialImpact}
              </Text>
            </Space>
          </Card>
        )}

        {/* Signal Date */}
        <Text type="secondary" style={{ fontSize: 11 }}>
          Reported: {formatDate(signal.signalDate)} ({formatRelativeDate(signal.signalDate)})
        </Text>
      </Space>
    </Card>
  );
}
