'use client';

/**
 * Source Drawer Component
 * Global drawer for displaying source metadata
 */

import React from 'react';
import {
  Drawer,
  Descriptions,
  Button,
  Space,
  Tag,
  Typography,
  Divider,
} from 'antd';
import {
  LinkOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { useSourceDrawer } from '../providers';
import { formatDate, formatRelativeDate } from '@/lib/formatters';
import { colors } from '@/styles/tokens';

const { Text, Paragraph, Link } = Typography;

export function SourceDrawer() {
  const { isOpen, source, closeSource } = useSourceDrawer();

  if (!source) return null;

  return (
    <Drawer
      title="Source Information"
      placement="right"
      onClose={closeSource}
      open={isOpen}
      width={400}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Demo Warning */}
        {source.isDemo && (
          <div
            style={{
              padding: '12px 16px',
              background: `${colors.demo}15`,
              borderRadius: 8,
              border: `1px solid ${colors.demo}`,
            }}
          >
            <Space>
              <ExperimentOutlined style={{ color: colors.demo }} />
              <Text style={{ color: colors.demo }}>
                This is representative demo data, not actual source data.
              </Text>
            </Space>
          </div>
        )}

        {/* Title */}
        {source.title && (
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Document Title
            </Text>
            <Paragraph
              strong
              style={{ marginBottom: 0, marginTop: 4, fontSize: 16 }}
            >
              {source.title}
            </Paragraph>
          </div>
        )}

        <Divider style={{ margin: '8px 0' }} />

        {/* Metadata */}
        <Descriptions column={1} size="small">
          <Descriptions.Item
            label={
              <Space>
                <LinkOutlined />
                <span>Source URL</span>
              </Space>
            }
          >
            {source.url ? (
              <Link
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ wordBreak: 'break-all' }}
              >
                {source.url}
              </Link>
            ) : (
              <Text type="secondary">Not available</Text>
            )}
          </Descriptions.Item>

          <Descriptions.Item
            label={
              <Space>
                <CalendarOutlined />
                <span>Published</span>
              </Space>
            }
          >
            {source.publishedAt ? (
              <Space>
                <Text>{formatDate(source.publishedAt, 'medium')}</Text>
                <Text type="secondary">
                  ({formatRelativeDate(source.publishedAt)})
                </Text>
              </Space>
            ) : (
              <Text type="secondary">Not specified</Text>
            )}
          </Descriptions.Item>

          <Descriptions.Item
            label={
              <Space>
                <ClockCircleOutlined />
                <span>Retrieved</span>
              </Space>
            }
          >
            {source.retrievedAt ? (
              <Space>
                <Text>{formatDate(source.retrievedAt, 'medium')}</Text>
                <Text type="secondary">
                  ({formatRelativeDate(source.retrievedAt)})
                </Text>
              </Space>
            ) : (
              <Text type="secondary">Not specified</Text>
            )}
          </Descriptions.Item>

          <Descriptions.Item label="Source ID">
            <Text code copyable style={{ fontSize: 11 }}>
              {source.sourceId}
            </Text>
          </Descriptions.Item>
        </Descriptions>

        <Divider style={{ margin: '8px 0' }} />

        {/* Actions */}
        <Space direction="vertical" style={{ width: '100%' }}>
          {source.url && (
            <Button
              type="primary"
              icon={<LinkOutlined />}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              block
            >
              Open Original Source
            </Button>
          )}

          <Button onClick={closeSource} block>
            Close
          </Button>
        </Space>

        {/* Disclaimer */}
        <Text
          type="secondary"
          style={{ fontSize: 11, display: 'block', textAlign: 'center' }}
        >
          Always verify information with official government sources before making
          decisions.
        </Text>
      </Space>
    </Drawer>
  );
}
