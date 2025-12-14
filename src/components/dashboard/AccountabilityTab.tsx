'use client';

/**
 * Accountability Tab Component
 * Decision timeline with filters, roll-call votes, officials
 */

import React, { useState, useMemo } from 'react';
import {
  Row,
  Col,
  Card,
  Typography,
  Space,
  Timeline,
  Select,
  DatePicker,
  Collapse,
  List,
  Avatar,
  Table,
  Tag,
  Skeleton,
  Empty,
  Alert,
  Divider,
} from 'antd';
import {
  UserOutlined,
  CalendarOutlined,
  FilterOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAccountability } from '@/hooks/use-api';
import {
  DataTypeBadge,
  ImpactBadge,
  VoteBadge,
  JurisdictionTag,
  SourceLink,
} from '@/components/shared';
import {
  formatDate,
  formatJurisdictionType,
} from '@/lib/formatters';
import { colors } from '@/styles/tokens';
import type { DecisionEventDetail, OfficialAtEvent, AccountabilityFilters, JurisdictionType, VoteValue } from '@/types';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface AccountabilityTabProps {
  geoUnitId: string;
}

const TAX_TYPE_OPTIONS = [
  { value: '', label: 'All Tax Types' },
  { value: 'property', label: 'Property Tax' },
  { value: 'sales', label: 'Sales Tax' },
  { value: 'income', label: 'Income Tax' },
];

export function AccountabilityTab({ geoUnitId }: AccountabilityTabProps) {
  const currentYear = new Date().getFullYear();
  const [filters, setFilters] = useState<AccountabilityFilters>({
    taxType: null,
    fromYear: currentYear - 5,
    toYear: currentYear,
    jurisdictionType: null,
    officialPersonId: null,
    impactDirection: 'all',
  });

  const { data, isLoading, error } = useAccountability({
    geoUnitId,
    taxType: filters.taxType || undefined,
    from: filters.fromYear,
    to: filters.toYear,
    enabled: !!geoUnitId,
  });

  const jurisdictionTypeOptions = useMemo(() => {
    const events = data?.events ?? [];
    const types = new Set<JurisdictionType>();
    events.forEach((e) => types.add(e.jurisdictionType));

    const rank: Partial<Record<JurisdictionType, number>> = {
      federal: 1,
      state: 2,
      county: 3,
      city: 4,
      school: 5,
      special: 6,
      other: 7,
    };

    return Array.from(types)
      .sort((a, b) => (rank[a] ?? 99) - (rank[b] ?? 99))
      .map((type) => ({
        value: type,
        label: formatJurisdictionType(type),
      }));
  }, [data?.events]);

  const officials = useMemo(() => {
    const events =
      filters.jurisdictionType && data?.events
        ? data.events.filter((e) => e.jurisdictionType === filters.jurisdictionType)
        : data?.events ?? [];

    const officialsMap = new Map<
      string,
      { personId: string; fullName: string; officeNames: Set<string> }
    >();

    for (const event of events) {
      for (const official of event.officialsAtEvent) {
        const existing = officialsMap.get(official.personId);
        if (existing) {
          existing.officeNames.add(official.officeName);
        } else {
          officialsMap.set(official.personId, {
            personId: official.personId,
            fullName: official.fullName,
            officeNames: new Set([official.officeName]),
          });
        }
      }

      for (const vr of event.voteRecords) {
        for (const vote of vr.votes) {
          const existing = officialsMap.get(vote.personId);
          if (existing) {
            if (vote.officeName) existing.officeNames.add(vote.officeName);
          } else {
            officialsMap.set(vote.personId, {
              personId: vote.personId,
              fullName: vote.fullName,
              officeNames: new Set(vote.officeName ? [vote.officeName] : []),
            });
          }
        }
      }
    }

    return Array.from(officialsMap.values())
      .map((o) => ({
        personId: o.personId,
        fullName: o.fullName,
        officeName: Array.from(o.officeNames.values()).sort()[0] ?? null,
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [data?.events, filters.jurisdictionType]);

  const selectedOfficial = useMemo(() => {
    if (!filters.officialPersonId) return null;
    return officials.find((o) => o.personId === filters.officialPersonId) ?? null;
  }, [filters.officialPersonId, officials]);

  // Filter events by governance level, impact direction, and highlighted official
  const filteredEvents = useMemo(() => {
    const events = data?.events ?? [];

    return events.filter((event) => {
      if (filters.jurisdictionType && event.jurisdictionType !== filters.jurisdictionType) {
        return false;
      }

      if (filters.impactDirection !== 'all') {
        const matchesDirection = event.impacts.some(
          (impact) => impact.impactDirection === filters.impactDirection
        );
        if (!matchesDirection) return false;
      }

      if (filters.officialPersonId) {
        const inVotes = event.voteRecords.some((vr) =>
          vr.votes.some((v) => v.personId === filters.officialPersonId)
        );
        const inOfficials = event.officialsAtEvent.some(
          (o) => o.personId === filters.officialPersonId
        );
        if (!inVotes && !inOfficials) return false;
      }

      return true;
    });
  }, [data?.events, filters.impactDirection, filters.jurisdictionType, filters.officialPersonId]);

  const currentOfficials = useMemo(() => {
    const sourceEvents =
      filters.jurisdictionType && data?.events
        ? data.events.filter((e) => e.jurisdictionType === filters.jurisdictionType)
        : data?.events ?? [];

    if (sourceEvents.length === 0) return [];

    const officialsMap = new Map<string, OfficialAtEvent>();
    const mostRecentEvent = sourceEvents[0];
    mostRecentEvent.officialsAtEvent.forEach((official) => {
      officialsMap.set(official.personId, official);
    });

    return Array.from(officialsMap.values());
  }, [data?.events, filters.jurisdictionType]);

  const selectedOfficialVoteSummary = useMemo(() => {
    if (!filters.officialPersonId) return null;

    const counts = {
      increaseYes: 0,
      increaseNo: 0,
      decreaseYes: 0,
      decreaseNo: 0,
      other: 0,
      total: 0,
    };

    for (const event of filteredEvents) {
      const hasIncrease = event.impacts.some((i) => i.impactDirection === 'increase');
      const hasDecrease = event.impacts.some((i) => i.impactDirection === 'decrease');
      const impactBucket: 'increase' | 'decrease' | 'other' =
        hasIncrease && !hasDecrease ? 'increase' : hasDecrease && !hasIncrease ? 'decrease' : 'other';

      for (const vr of event.voteRecords) {
        const vote = vr.votes.find((v) => v.personId === filters.officialPersonId);
        if (!vote) continue;

        counts.total += 1;
        const value = vote.voteValue as VoteValue;

        if (impactBucket === 'increase') {
          if (value === 'yes') counts.increaseYes += 1;
          else if (value === 'no') counts.increaseNo += 1;
          else counts.other += 1;
        } else if (impactBucket === 'decrease') {
          if (value === 'yes') counts.decreaseYes += 1;
          else if (value === 'no') counts.decreaseNo += 1;
          else counts.other += 1;
        } else {
          counts.other += 1;
        }
      }
    }

    return counts;
  }, [filteredEvents, filters.officialPersonId]);

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="Error Loading Accountability Data"
          description={error.message}
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={24}>
        {/* Main Timeline */}
        <Col xs={24} lg={17}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Filters */}
            <Card size="small">
              <Space wrap>
                <Space>
                  <FilterOutlined />
                  <Text strong>Filters:</Text>
                </Space>
                <Select
                  value={filters.taxType || ''}
                  onChange={(value) =>
                    setFilters((f) => ({ ...f, taxType: value || null }))
                  }
                  options={TAX_TYPE_OPTIONS}
                  style={{ width: 150 }}
                  aria-label="Filter by tax type"
                />
                <Select
                  value={filters.jurisdictionType || ''}
                  onChange={(value) =>
                    setFilters((f) => ({
                      ...f,
                      jurisdictionType: (value as JurisdictionType) || null,
                      officialPersonId: null,
                    }))
                  }
                  options={[
                    { value: '', label: 'All Levels' },
                    ...jurisdictionTypeOptions,
                  ]}
                  style={{ width: 160 }}
                  aria-label="Filter by governance level"
                />
                <Select
                  value={filters.officialPersonId || ''}
                  onChange={(value) =>
                    setFilters((f) => ({
                      ...f,
                      officialPersonId: value || null,
                    }))
                  }
                  options={[
                    { value: '', label: 'All Officials' },
                    ...officials.map((o) => ({
                      value: o.personId,
                      label: o.officeName ? `${o.fullName} — ${o.officeName}` : o.fullName,
                    })),
                  ]}
                  style={{ width: 260 }}
                  showSearch
                  filterOption={(input, option) =>
                    String(option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  aria-label="Highlight an elected official"
                />
                <Select
                  value={filters.impactDirection}
                  onChange={(value) =>
                    setFilters((f) => ({
                      ...f,
                      impactDirection: value as AccountabilityFilters['impactDirection'],
                    }))
                  }
                  options={[
                    { value: 'all', label: 'All Impacts' },
                    { value: 'increase', label: 'Tax Increases' },
                    { value: 'decrease', label: 'Tax Decreases' },
                  ]}
                  style={{ width: 150 }}
                  aria-label="Filter by tax impact direction"
                />
                <RangePicker
                  picker="year"
                  value={[
                    dayjs().year(filters.fromYear),
                    dayjs().year(filters.toYear),
                  ]}
                  onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                      setFilters((f) => ({
                        ...f,
                        fromYear: dates[0]!.year(),
                        toYear: dates[1]!.year(),
                      }));
                    }
                  }}
                  allowClear={false}
                  aria-label="Filter by year range"
                />
              </Space>
            </Card>

            {/* Timeline */}
            <Card
              title={
                <Space>
                  <CalendarOutlined />
                  <span>Decision Timeline</span>
                  <Tag>{filteredEvents.length} events</Tag>
                </Space>
              }
            >
              {filteredEvents.length === 0 ? (
                <Empty description="No decisions found for the selected filters" />
                ) : (
                  <Timeline
                    mode="left"
                    items={filteredEvents.map((event) => ({
                    color: event.impacts.some(
                      (i) => i.impactDirection === 'increase'
                    )
                      ? colors.impact.increase
                      : event.impacts.some((i) => i.impactDirection === 'decrease')
                      ? colors.impact.decrease
                      : colors.impact.neutral,
                     label: formatDate(event.eventDate, 'short'),
                     children: (
                       <DecisionEventCard
                         event={event}
                         highlightPersonId={filters.officialPersonId}
                       />
                     ),
                   }))}
                 />
               )}
             </Card>
           </Space>
        </Col>

        {/* Officials Rail */}
        <Col xs={24} lg={7}>
          <Card
            title={
              <Space>
                <UserOutlined />
                <span>Current Officials</span>
              </Space>
            }
            style={{ position: 'sticky', top: 100 }}
          >
            {filters.officialPersonId && selectedOfficial && selectedOfficialVoteSummary && (
              <>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Highlighting: {selectedOfficial.fullName}
                </Text>
                <Space wrap style={{ marginTop: 8 }}>
                  <Tag color={colors.vote.yes}>
                    Increase • Yes: {selectedOfficialVoteSummary.increaseYes}
                  </Tag>
                  <Tag color={colors.vote.no}>
                    Increase • No: {selectedOfficialVoteSummary.increaseNo}
                  </Tag>
                  <Tag color={colors.vote.yes}>
                    Decrease • Yes: {selectedOfficialVoteSummary.decreaseYes}
                  </Tag>
                  <Tag color={colors.vote.no}>
                    Decrease • No: {selectedOfficialVoteSummary.decreaseNo}
                  </Tag>
                  {selectedOfficialVoteSummary.other > 0 && (
                    <Tag>Other: {selectedOfficialVoteSummary.other}</Tag>
                  )}
                </Space>
                <Divider style={{ margin: '12px 0' }} />
              </>
            )}
            {currentOfficials.length === 0 ? (
              <Empty
                description="No officials found"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <List
                dataSource={currentOfficials}
                renderItem={(official) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <Avatar icon={<UserOutlined />} />
                      }
                      title={official.fullName}
                      description={
                        <Space direction="vertical" size={0}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {official.officeName}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            Since {formatDate(official.termStart, 'short')}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

// Decision Event Card
function DecisionEventCard({
  event,
  highlightPersonId,
}: {
  event: DecisionEventDetail;
  highlightPersonId: string | null;
}) {
  // Vote record columns
  const voteColumns = [
    {
      title: 'Official',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (name: string, record: any) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <div>
            <Text strong style={{ fontSize: 13 }}>{name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {record.officeName}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Vote',
      dataIndex: 'voteValue',
      key: 'voteValue',
      render: (vote: string) => <VoteBadge vote={vote as any} />,
    },
  ];

  return (
    <Card size="small" style={{ marginBottom: 8 }}>
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {/* Header */}
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <JurisdictionTag type={event.jurisdictionType} name={event.jurisdictionName} />
            <DataTypeBadge dataType={event.dataType} size="small" />
          </Space>
          <SourceLink source={event.source} />
        </Space>

        {/* Title */}
        <Text strong>{event.title}</Text>

        {/* Summary */}
        {event.summary && (
          <Text type="secondary" style={{ fontSize: 13 }}>
            {event.summary}
          </Text>
        )}

        {/* Impacts */}
        {event.impacts.length > 0 && (
          <Space wrap>
            {event.impacts.map((impact, idx) => (
              <ImpactBadge
                key={idx}
                direction={impact.impactDirection}
                deltaRate={impact.deltaRateValue}
                deltaRevenue={impact.deltaRevenueAmount}
                description={impact.deltaDescription}
              />
            ))}
          </Space>
        )}

        {/* Vote Records */}
        {event.voteRecords.length > 0 && (
          <Collapse
            ghost
            items={event.voteRecords.map((vr, idx) => ({
              key: idx,
              label: (
                <Space>
                  {vr.passed ? (
                    <CheckCircleOutlined style={{ color: colors.vote.yes }} />
                  ) : vr.passed === false ? (
                    <CloseCircleOutlined style={{ color: colors.vote.no }} />
                  ) : null}
                  <Text>
                    Vote: {vr.yesCount} Yes, {vr.noCount} No
                    {vr.passed !== null && (
                      <span> - {vr.passed ? 'Passed' : 'Failed'}</span>
                    )}
                  </Text>
                </Space>
              ),
              children: (
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  {highlightPersonId && (
                    (() => {
                      const highlightedVote = vr.votes.find((v) => v.personId === highlightPersonId);
                      if (!highlightedVote) return null;
                      return (
                        <Space size="small">
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Selected official:
                          </Text>
                          <VoteBadge vote={highlightedVote.voteValue as VoteValue} size="small" />
                        </Space>
                      );
                    })()
                  )}
                  {vr.question && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Question: {vr.question}
                    </Text>
                  )}
                  {vr.votes.length > 0 && (
                    <Table
                      dataSource={vr.votes}
                      columns={voteColumns}
                      rowKey="personId"
                      size="small"
                      pagination={false}
                      rowClassName={(record) =>
                        highlightPersonId && record.personId === highlightPersonId
                          ? 'taxatlas-vote-highlight-row'
                          : ''
                      }
                    />
                  )}
                  <SourceLink source={vr.source} />
                </Space>
              ),
            }))}
          />
        )}

        {/* Effective Date */}
        {event.effectiveDate && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            Effective: {formatDate(event.effectiveDate)}
          </Text>
        )}
      </Space>
    </Card>
  );
}
