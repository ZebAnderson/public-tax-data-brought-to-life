'use client';

/**
 * TaxAtlas Dashboard Page
 * /place/[geoUnitId]
 */

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Typography,
  Space,
  Tabs,
  Breadcrumb,
  Row,
  Col,
  Skeleton,
  Alert,
  Card,
} from 'antd';
import {
  HomeOutlined,
  DollarOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  BookOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useSummary } from '@/hooks/use-api';
import { usePresenceMode } from '@/components/providers';
import { MapPreview, DataTypeBadge } from '@/components/shared';
import { TaxesTab } from '@/components/dashboard/TaxesTab';
import { AccountabilityTab } from '@/components/dashboard/AccountabilityTab';
import { PendingTab } from '@/components/dashboard/PendingTab';
import { MethodologyTab } from '@/components/dashboard/MethodologyTab';
import { IncomePayTypePanel } from '@/components/dashboard/IncomePayTypePanel';
import { formatGeoUnitType, formatPresenceMode } from '@/lib/formatters';
import { colors } from '@/styles/tokens';
import type { DashboardTab } from '@/types';

const { Title, Text } = Typography;

export default function DashboardPage() {
  const params = useParams();
  const geoUnitId = params.geoUnitId as string;
  const { apiMode } = usePresenceMode();
  const [activeTab, setActiveTab] = useState<DashboardTab>('taxes');

  const {
    data: summary,
    isLoading,
    error,
  } = useSummary({
    geoUnitId,
    mode: apiMode,
    enabled: !!geoUnitId,
  });

  // Loading state
  if (isLoading) {
    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Skeleton active paragraph={{ rows: 2 }} />
        <Row gutter={24}>
          <Col xs={24} md={18}>
            <Skeleton active paragraph={{ rows: 8 }} />
          </Col>
          <Col xs={24} md={6}>
            <Skeleton.Image style={{ width: '100%', height: 200 }} active />
          </Col>
        </Row>
      </Space>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert
        message="Error Loading Place"
        description={error.message || 'Unable to load place data. Please try again.'}
        type="error"
        showIcon
      />
    );
  }

  // No data state
  if (!summary) {
    return (
      <Alert
        message="Place Not Found"
        description="The requested place could not be found."
        type="warning"
        showIcon
      />
    );
  }

  // Tab items
  const tabItems = [
    {
      key: 'taxes',
      label: (
        <Space>
          <DollarOutlined />
          <span>Taxes</span>
        </Space>
      ),
      children: <TaxesTab geoUnitId={geoUnitId} summary={summary} />,
    },
    {
      key: 'accountability',
      label: (
        <Space>
          <TeamOutlined />
          <span>Accountability</span>
        </Space>
      ),
      children: <AccountabilityTab geoUnitId={geoUnitId} />,
    },
    {
      key: 'pending',
      label: (
        <Space>
          <ClockCircleOutlined />
          <span>Pending</span>
        </Space>
      ),
      children: <PendingTab geoUnitId={geoUnitId} />,
    },
    {
      key: 'methodology',
      label: (
        <Space>
          <BookOutlined />
          <span>Methodology</span>
        </Space>
      ),
      children: <MethodologyTab />,
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          {
            title: (
              <Link href="/">
                <HomeOutlined /> Home
              </Link>
            ),
          },
          {
            title: summary.displayName,
          },
        ]}
      />

      {/* Header */}
      <Row gutter={24} align="top">
        <Col xs={24} md={18}>
          <Space direction="vertical" size="small">
            {/* Title */}
            <Space align="center">
              <Title level={2} style={{ marginBottom: 0 }}>
                {summary.name}
              </Title>
              {summary.isDemo && (
                <DataTypeBadge dataType="estimate" showLabel />
              )}
            </Space>

            {/* Subtitle */}
            <Space split={<span style={{ color: colors.neutral.border }}>·</span>}>
              <Text type="secondary">
                {formatGeoUnitType(summary.geoUnitType)}
              </Text>
              <Text type="secondary">{summary.stateCode}</Text>
              <Text type="secondary">
                Tax Year {summary.taxYear}
              </Text>
              <Text type="secondary">
                Mode: {formatPresenceMode(summary.presenceMode)}
              </Text>
            </Space>

            {/* Jurisdictions summary */}
            <Text type="secondary" style={{ fontSize: 13 }}>
              {summary.jurisdictions.length} taxing jurisdiction
              {summary.jurisdictions.length !== 1 ? 's' : ''} apply:{' '}
              {summary.jurisdictions.slice(0, 3).map((j) => j.name).join(', ')}
              {summary.jurisdictions.length > 3 &&
                ` +${summary.jurisdictions.length - 3} more`}
            </Text>

            {/* Demo warning */}
            {summary.isDemo && (
              <Alert
                message="Demo Data"
                description="This data is representative only for demonstration purposes. Do not use for actual tax decisions."
                type="warning"
                showIcon
                style={{ marginTop: 8 }}
              />
            )}
          </Space>
        </Col>

        {/* Map Preview */}
        <Col xs={24} md={6}>
          <MapPreview
            bbox={summary.bbox}
            centroid={summary.centroid}
            name={summary.name}
            height={180}
            showExpand
          />
        </Col>
      </Row>

      {/* Income & Pay Type */}
      <IncomePayTypePanel />

      {/* Tabs */}
      <Card styles={{ body: { padding: 0 } }}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as DashboardTab)}
          items={tabItems}
          size="large"
          tabBarStyle={{ padding: '0 24px', marginBottom: 0 }}
        />
      </Card>
    </Space>
  );
}
