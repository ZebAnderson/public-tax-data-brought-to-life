'use client';

/**
 * TaxAtlas Home Page
 * Place search + mode toggle + examples
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Typography,
  Space,
  AutoComplete,
  Input,
  Segmented,
  Card,
  Row,
  Col,
  Spin,
  Empty,
  Alert,
  Tag,
} from 'antd';
import {
  SearchOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  ShopOutlined,
  AimOutlined,
} from '@ant-design/icons';
import { useResolve, usePrefetchSummary } from '@/hooks/use-api';
import { usePresenceMode } from '@/components/providers';
import { config } from '@/lib/config';
import { colors } from '@/styles/tokens';
import { formatGeoUnitType } from '@/lib/formatters';
import type { ResolvedPlace, PresenceModeOption } from '@/types';

const { Title, Text, Paragraph } = Typography;

// Presence mode options
const modeOptions = [
  { label: 'Live', value: 'live', icon: <HomeOutlined /> },
  { label: 'Work', value: 'work', icon: <ShopOutlined /> },
  { label: 'Both', value: 'both', icon: <EnvironmentOutlined /> },
];

// Helper to detect if query looks like an address
function isAddressQuery(query: string): boolean {
  // Simple heuristic: contains a number followed by letters (street number + street name)
  return /^\d+\s+\w+/.test(query.trim());
}

export default function HomePage() {
  const router = useRouter();
  const { mode, setMode } = usePresenceMode();
  const prefetchSummary = usePrefetchSummary();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [searchValue, setSearchValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Debounced search
  const { data: resolveData, isLoading, error } = useResolve({
    q: searchQuery,
    state: 'MN', // Minneapolis pilot
    enabled: searchQuery.length >= 2,
  });

  // Handle search input change with debounce
  const handleSearch = useCallback((value: string) => {
    setSearchValue(value);
    // Clear previous timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    // Set new debounce
    debounceRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 300);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Handle place selection - use displayName to show in input, navigate with geoUnitId
  const handleSelect = (value: string, option: { place: ResolvedPlace; displayName: string }) => {
    const place = option.place;
    // Show the display name in the input
    setSearchValue(option.displayName);
    // Navigate to the place
    router.push(`/place/${place.geoUnitId}`);
  };

  // Handle hover for prefetch
  const handleHover = (place: ResolvedPlace) => {
    prefetchSummary(place.geoUnitId);
  };

  // Check if this looks like an address search
  const isAddress = isAddressQuery(searchQuery);

  // Build autocomplete options
  const options = resolveData?.results.map((place) => {
    const displayName = place.displayName || `${place.name}, ${place.stateCode}`;
    return {
      value: displayName, // Use display name as value so it shows in input
      label: (
        <Space
          style={{ width: '100%', justifyContent: 'space-between' }}
          onMouseEnter={() => handleHover(place)}
        >
          <Space>
            <EnvironmentOutlined style={{ color: colors.primary }} />
            <div>
              <Text strong>{place.name}</Text>
              {place.matchedAlias && place.matchedAlias !== place.name && (
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                  (matched: {place.matchedAlias})
                </Text>
              )}
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {formatGeoUnitType(place.geoUnitType)} · {place.stateCode}
              </Text>
            </div>
          </Space>
        </Space>
      ),
      place,
      displayName,
    };
  }) ?? [];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', paddingTop: 48 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Hero Section */}
        <div style={{ textAlign: 'center' }}>
          <Title level={1} style={{ marginBottom: 8 }}>
            Know Your Tax Burden
          </Title>
          <Paragraph type="secondary" style={{ fontSize: 18, marginBottom: 32 }}>
            Enter an address, neighborhood, ZIP code, or city to see all applicable taxes,
            who voted for them, and what&apos;s pending.
          </Paragraph>
        </div>

        {/* Mode Toggle */}
        <div style={{ textAlign: 'center' }}>
          <Space direction="vertical" size="small">
            <Text type="secondary">I want to see taxes for where I:</Text>
            <Segmented
              options={modeOptions.map((opt) => ({
                label: (
                  <Space>
                    {opt.icon}
                    <span>{opt.label}</span>
                  </Space>
                ),
                value: opt.value,
              }))}
              value={mode}
              onChange={(value) => setMode(value as PresenceModeOption)}
              size="large"
            />
          </Space>
        </div>

        {/* Search Box */}
        <Card style={{ padding: '24px 16px' }}>
          <AutoComplete
            style={{ width: '100%' }}
            options={options}
            value={searchValue}
            onChange={handleSearch}
            onSelect={handleSelect}
            notFoundContent={
              isLoading ? (
                <Spin size="small" />
              ) : searchQuery.length >= 2 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    isAddress
                      ? "Address not found. Try a neighborhood or ZIP code."
                      : "No places found"
                  }
                />
              ) : null
            }
            aria-label="Search for a location"
          >
            <Input
              size="large"
              placeholder="Enter an address, neighborhood, or ZIP code..."
              prefix={<SearchOutlined style={{ color: colors.neutral.textTertiary }} />}
              suffix={
                isAddress && searchQuery.length >= 2 ? (
                  <Tag color="blue" style={{ marginRight: 0 }}>
                    <AimOutlined /> Address
                  </Tag>
                ) : null
              }
            />
          </AutoComplete>

          {/* Address mode hint */}
          {isAddress && resolveData?.results && resolveData.results.length > 0 && (
            <Alert
              message="Address matched to neighborhood"
              description="We found the neighborhood containing this address. Select it to see tax details."
              type="info"
              showIcon
              icon={<AimOutlined />}
              style={{ marginTop: 16 }}
            />
          )}

          {/* Low confidence warning */}
          {!isAddress && resolveData?.confidence === 'low' && resolveData.results.length > 0 && (
            <Alert
              message="Multiple matches found"
              description="Please select the correct location from the list above."
              type="info"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}

          {error && (
            <Alert
              message="Search Error"
              description={error.message}
              type="error"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </Card>

        {/* Example Places (Minneapolis Pilot) */}
        <div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            Or try one of these Minneapolis neighborhoods:
          </Text>
          <Row gutter={[12, 12]}>
            {config.pilotNeighborhoods.map((neighborhood) => (
              <Col key={neighborhood} xs={12} sm={8} md={6}>
                <Card
                  hoverable
                  size="small"
                  onClick={() => {
                    setSearchValue(neighborhood);
                    setSearchQuery(neighborhood);
                  }}
                  style={{ textAlign: 'center' }}
                >
                  <Text>{neighborhood}</Text>
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        {/* Info Section */}
        <Card style={{ background: colors.neutral.bg }}>
          <Row gutter={24}>
            <Col xs={24} md={8}>
              <Space direction="vertical" size="small">
                <Text strong>Transparent Data</Text>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Every number links to its official source. No black boxes.
                </Text>
              </Space>
            </Col>
            <Col xs={24} md={8}>
              <Space direction="vertical" size="small">
                <Text strong>Accountability</Text>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  See who voted for tax changes and how they voted.
                </Text>
              </Space>
            </Col>
            <Col xs={24} md={8}>
              <Space direction="vertical" size="small">
                <Text strong>Stay Informed</Text>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Track proposed budgets, bills, and ballot measures.
                </Text>
              </Space>
            </Col>
          </Row>
        </Card>
      </Space>
    </div>
  );
}
