'use client';

/**
 * TaxAtlas Main Layout
 * App shell with header and footer
 */

import React from 'react';
import { Layout, Typography, Space, Alert } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { config } from '@/lib/config';
import { colors } from '@/styles/tokens';
import { SourceDrawer } from '../shared/SourceDrawer';

const { Header, Content, Footer } = Layout;
const { Text } = Typography;

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Demo Banner */}
      {config.useMockData && (
        <Alert
          message="DEMO MODE: This data is representative only. Not real tax data."
          type="warning"
          banner
          showIcon
          style={{
            background: colors.demo,
            color: '#fff',
            borderRadius: 0,
          }}
        />
      )}

      {/* Header */}
      <Header
        style={{
          background: colors.neutral.bgContainer,
          borderBottom: `1px solid ${colors.neutral.border}`,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: config.useMockData ? 38 : 0,
          zIndex: 100,
        }}
      >
        <Link href="/" style={{ textDecoration: 'none' }}>
          <Space>
            <EnvironmentOutlined style={{ fontSize: 24, color: colors.primary }} />
            <Text
              strong
              style={{
                fontSize: 20,
                color: colors.neutral.text,
              }}
            >
              TaxAtlas
            </Text>
          </Space>
        </Link>

        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Minneapolis Pilot
          </Text>
        </Space>
      </Header>

      {/* Main Content */}
      <Content
        style={{
          padding: '24px',
          background: colors.neutral.bg,
          minHeight: 'calc(100vh - 64px - 69px)',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </div>
      </Content>

      {/* Footer */}
      <Footer
        style={{
          textAlign: 'center',
          background: colors.neutral.bgContainer,
          borderTop: `1px solid ${colors.neutral.border}`,
        }}
      >
        <Space direction="vertical" size={4}>
          <Text type="secondary">
            TaxAtlas - Making tax data accessible and transparent
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Data is sourced from official government records. Always verify with official sources before making decisions.
          </Text>
        </Space>
      </Footer>

      {/* Global Source Drawer */}
      <SourceDrawer />
    </Layout>
  );
}
