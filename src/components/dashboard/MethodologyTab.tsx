'use client';

/**
 * Methodology Tab Component
 * Information about data sources and calculations
 */

import React from 'react';
import { Card, Typography, Space, Collapse, List, Tag, Divider } from 'antd';
import {
  BookOutlined,
  FileTextOutlined,
  CalculatorOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { DataTypeBadge } from '@/components/shared';
import { colors } from '@/styles/tokens';

const { Title, Text, Paragraph, Link } = Typography;

export function MethodologyTab() {
  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Introduction */}
        <Card>
          <Space direction="vertical" size="middle">
            <Space>
              <BookOutlined style={{ fontSize: 24, color: colors.primary }} />
              <Title level={4} style={{ marginBottom: 0 }}>
                About This Data
              </Title>
            </Space>
            <Paragraph>
              TaxAtlas aggregates tax data from official government sources to provide
              a comprehensive view of tax obligations for any location. We prioritize
              transparency, accuracy, and traceability.
            </Paragraph>
          </Space>
        </Card>

        {/* Data Types */}
        <Card
          title={
            <Space>
              <DatabaseOutlined />
              <span>Data Type Indicators</span>
            </Space>
          }
        >
          <List
            dataSource={[
              {
                type: 'fact' as const,
                title: 'Verified Facts',
                description:
                  'Data directly from official government sources. No calculation or estimation involved.',
                examples: 'Tax rates from official rate schedules, vote records from meeting minutes',
              },
              {
                type: 'estimate' as const,
                title: 'Estimates',
                description:
                  'Calculated values based on official data and documented assumptions. May involve aggregation across jurisdictions or median household calculations.',
                examples: 'Combined tax rates across jurisdictions, estimated annual tax burden',
              },
              {
                type: 'signal' as const,
                title: 'Signals',
                description:
                  'Proposed or pending items that are NOT enacted law. Outcomes are uncertain. These are provided for awareness only.',
                examples: 'Proposed budgets, pending legislation, upcoming ballot measures',
              },
            ]}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<DataTypeBadge dataType={item.type} />}
                  title={item.title}
                  description={
                    <Space direction="vertical" size={4}>
                      <Text type="secondary">{item.description}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Examples: {item.examples}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>

        {/* Data Sources */}
        <Card
          title={
            <Space>
              <FileTextOutlined />
              <span>Data Sources</span>
            </Space>
          }
        >
          <Collapse
            items={[
              {
                key: 'property',
                label: 'Property Tax Data',
                children: (
                  <Space direction="vertical" size={8}>
                    <Text>Sources include:</Text>
                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                      <li>County assessor offices</li>
                      <li>City finance departments</li>
                      <li>School district budget documents</li>
                      <li>Special district filings</li>
                    </ul>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Property tax rates are updated annually after final levy certification.
                    </Text>
                  </Space>
                ),
              },
              {
                key: 'sales',
                label: 'Sales Tax Data',
                children: (
                  <Space direction="vertical" size={8}>
                    <Text>Sources include:</Text>
                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                      <li>State Department of Revenue</li>
                      <li>City sales tax ordinances</li>
                      <li>Transit authority tax documents</li>
                    </ul>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Sales tax rates are updated as changes are enacted.
                    </Text>
                  </Space>
                ),
              },
              {
                key: 'income',
                label: 'Income Tax Data',
                children: (
                  <Space direction="vertical" size={8}>
                    <Text>Sources include:</Text>
                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                      <li>IRS tax tables (federal)</li>
                      <li>State Department of Revenue (state income tax)</li>
                      <li>Local income tax ordinances where applicable</li>
                    </ul>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Progressive rates are shown as brackets. Effective rates depend on income.
                    </Text>
                  </Space>
                ),
              },
              {
                key: 'accountability',
                label: 'Accountability Data',
                children: (
                  <Space direction="vertical" size={8}>
                    <Text>Sources include:</Text>
                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                      <li>Official meeting minutes</li>
                      <li>Roll call vote records</li>
                      <li>Budget resolutions</li>
                      <li>Election results (for ballot measures)</li>
                    </ul>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Vote records are attributed to officials based on their term dates.
                    </Text>
                  </Space>
                ),
              },
            ]}
          />
        </Card>

        {/* Calculations */}
        <Card
          title={
            <Space>
              <CalculatorOutlined />
              <span>Calculations & Methodology</span>
            </Space>
          }
        >
          <Space direction="vertical" size="middle">
            <div>
              <Text strong>Combined Tax Rates</Text>
              <Paragraph type="secondary" style={{ marginTop: 4 }}>
                When multiple jurisdictions apply to a location, rates are combined
                using coverage ratios. For example, if a neighborhood is 100% within
                a city, the city&apos;s rate is applied at 100%. If split between
                jurisdictions, rates are weighted accordingly.
              </Paragraph>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            <div>
              <Text strong>Tax Burden Estimates</Text>
              <Paragraph type="secondary" style={{ marginTop: 4 }}>
                Annual tax burden estimates assume a &quot;typical&quot; household with:
              </Paragraph>
              <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
                <li>
                  <Text type="secondary">
                    Median household income for the state
                  </Text>
                </li>
                <li>
                  <Text type="secondary">
                    Median home value for the specific location
                  </Text>
                </li>
                <li>
                  <Text type="secondary">
                    Average consumer spending patterns from BLS data
                  </Text>
                </li>
              </ul>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Your actual tax burden will vary based on your specific circumstances.
              </Text>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            <div>
              <Text strong>Trend Calculations</Text>
              <Paragraph type="secondary" style={{ marginTop: 4 }}>
                Change percentages are calculated as: ((Final Rate - Initial Rate) / Initial Rate) × 100.
                This represents the cumulative change over the displayed time period.
              </Paragraph>
            </div>
          </Space>
        </Card>

        {/* Disclaimer */}
        <Card
          style={{
            background: colors.neutral.bg,
            border: `1px solid ${colors.neutral.border}`,
          }}
        >
          <Space>
            <SafetyCertificateOutlined
              style={{ fontSize: 24, color: colors.neutral.textSecondary }}
            />
            <div>
              <Text strong>Disclaimer</Text>
              <Paragraph
                type="secondary"
                style={{ marginBottom: 0, marginTop: 4, fontSize: 13 }}
              >
                This data is provided for informational purposes only. Always verify
                with official government sources before making financial decisions.
                Tax laws and rates change frequently. TaxAtlas is not a substitute
                for professional tax advice.
              </Paragraph>
            </div>
          </Space>
        </Card>
      </Space>
    </div>
  );
}
