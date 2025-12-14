'use client';

/**
 * Taxes Tab Component
 * Tax cards, trend charts, and burden estimate
 */

import React, { useMemo, useState } from 'react';
import {
  Row,
  Col,
  Card,
  Typography,
  Space,
  Statistic,
  Collapse,
  Table,
  Skeleton,
  Empty,
  Alert,
  Divider,
  Button,
  Drawer,
  InputNumber,
  Form,
  Segmented,
  Switch,
  Tooltip,
  Tag,
} from 'antd';
import {
  DollarOutlined,
  InfoCircleOutlined,
  DownOutlined,
  EditOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useTaxes } from '@/hooks/use-api';
import {
  TaxCard,
  TrendChart,
  DataTypeBadge,
  SourceLink,
  JurisdictionTag,
} from '@/components/shared';
import {
  formatCurrency,
  formatRate,
  formatPercent,
  formatTaxType,
} from '@/lib/formatters';
import { colors, getJurisdictionColor } from '@/styles/tokens';
import { useUserAssumptions } from '@/components/providers';
import type { PlaceSummaryResponse, TaxCategoryDetail, PayType, UserAssumptions, DataType, SourceReference, PayrollBreakdown } from '@/types';

const { Title, Text, Paragraph } = Typography;

interface TaxesTabProps {
  geoUnitId: string;
  summary: PlaceSummaryResponse;
}

const PAY_TYPE_OPTIONS: Array<{ value: PayType; label: string }> = [
  { value: 'w2', label: 'W-2 employee' },
  { value: 'contractor_1099', label: '1099 / contractor' },
  { value: 'self_employed', label: 'Self-employed' },
  { value: 'mixed_unsure', label: 'Mixed / unsure' },
];

export function TaxesTab({ geoUnitId, summary }: TaxesTabProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [isAssumptionsDrawerOpen, setIsAssumptionsDrawerOpen] = useState(false);
  const { assumptions, setPayType, updateAssumptions, resetAssumptions } = useUserAssumptions();

  const { data: taxesData, isLoading, error } = useTaxes({
    geoUnitId,
    enabled: !!geoUnitId,
  });

  const payrollModel = useMemo(() => buildPayrollModel(assumptions), [assumptions]);

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
          message="Error Loading Tax Data"
          description={error.message}
          type="error"
          showIcon
        />
      </div>
    );
  }

  const categories = taxesData?.categories ?? [];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Tax Cards Grid */}
        <div>
          <Title level={4} style={{ marginBottom: 16 }}>
            Tax Rates Overview
          </Title>
          <Row gutter={[16, 16]}>
            {summary.taxCards.map((card) => (
              <Col key={card.taxType} xs={24} sm={12} md={8} lg={6}>
                <TaxCard
                  card={card}
                  onClick={() =>
                    setExpandedCategory(
                      expandedCategory === card.taxType ? null : card.taxType
                    )
                  }
                />
              </Col>
            ))}
          </Row>
        </div>

        {/* Burden Estimate */}
        {summary.burdenEstimate && (
          <Card>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <Title level={4} style={{ marginBottom: 0 }}>
                    Estimated Total Tax Burden
                  </Title>
                  <DataTypeBadge dataType={summary.burdenEstimate.dataType} />
                </Space>
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => setIsAssumptionsDrawerOpen(true)}
                >
                  Edit assumptions
                </Button>
              </Space>

              <Row gutter={24} align="middle">
                <Col xs={24} md={8}>
                  <Statistic
                    title="Annual Total"
                    value={summary.burdenEstimate.totalAmount}
                    formatter={(value) =>
                      formatCurrency(value as number, { decimals: 0 })
                    }
                    valueStyle={{ fontSize: 36, fontWeight: 600 }}
                    prefix={<DollarOutlined />}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    For {summary.taxYear} · Based on median household
                  </Text>
                </Col>

                <Col xs={24} md={16}>
                  <Row gutter={16}>
                    {summary.burdenEstimate.components.map((comp) => (
                      <Col key={comp.taxType} span={8}>
                        <Statistic
                          title={formatTaxType(comp.taxType)}
                          value={comp.amount}
                          formatter={(value) =>
                            formatCurrency(value as number, { decimals: 0 })
                          }
                          valueStyle={{ fontSize: 20 }}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {formatPercent(comp.percentage)} of total
                        </Text>
                      </Col>
                    ))}
                  </Row>
                </Col>
              </Row>

              {/* Assumptions Panel */}
              <Collapse
                ghost
                items={[
                  {
                    key: 'assumptions',
                    label: (
                      <Space>
                        <InfoCircleOutlined />
                        <Text type="secondary">View assumptions</Text>
                      </Space>
                    ),
                    children: (
                      <div style={{ padding: '8px 0' }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          This estimate assumes:
                        </Text>
                        <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                          <li>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Median household income for {summary.stateCode}
                            </Text>
                          </li>
                          <li>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Median home value for {summary.name}
                            </Text>
                          </li>
                          <li>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Average consumer spending patterns
                            </Text>
                          </li>
                        </ul>
                        <SourceLink
                          source={summary.burdenEstimate.source}
                          label="View methodology"
                        />
                      </div>
                    ),
                  },
                ]}
              />
            </Space>
          </Card>
        )}

        {/* Payroll / Pay Type Education */}
        <PayrollSection
          assumptions={assumptions}
          model={payrollModel}
          apiBreakdown={summary.burdenEstimate?.payrollBreakdown ?? null}
        />

        {/* Detailed Tax Categories with Trends */}
        {categories.length > 0 && (
          <div>
            <Title level={4} style={{ marginBottom: 16 }}>
              Tax Rate Trends
            </Title>
            <Row gutter={[16, 16]}>
              {categories.map((category) => (
                <Col key={category.taxType} xs={24} lg={12}>
                  <TaxCategoryCard category={category} />
                </Col>
              ))}
            </Row>
          </div>
        )}

        {categories.length === 0 && !isLoading && (
          <Empty description="No detailed tax data available" />
        )}
      </Space>

      <Drawer
        title="Edit assumptions"
        open={isAssumptionsDrawerOpen}
        onClose={() => setIsAssumptionsDrawerOpen(false)}
        width={520}
        extra={
          <Button onClick={resetAssumptions}>
            Reset
          </Button>
        }
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Space align="center" style={{ marginBottom: 8 }}>
              <Text strong>Pay type</Text>
              <Tooltip title="W-2 workers often see only withholding; employers may pay additional payroll taxes not shown on a pay stub.">
                <InfoCircleOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />
              </Tooltip>
            </Space>
            <Segmented
              options={PAY_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={assumptions.payType}
              onChange={(value) => setPayType(value as PayType)}
              block
            />
          </div>

          <Form layout="vertical">
            <Form.Item label="Annual wage income (W-2)">
              <InputNumber
                style={{ width: '100%' }}
                prefix="$"
                min={0}
                value={assumptions.annualW2WageIncome ?? undefined}
                onChange={(val) =>
                  updateAssumptions({ annualW2WageIncome: typeof val === 'number' ? val : null })
                }
                placeholder="Optional"
              />
            </Form.Item>
            <Form.Item label="Annual 1099 income">
              <InputNumber
                style={{ width: '100%' }}
                prefix="$"
                min={0}
                value={assumptions.annual1099Income ?? undefined}
                onChange={(val) =>
                  updateAssumptions({ annual1099Income: typeof val === 'number' ? val : null })
                }
                placeholder="Optional"
              />
            </Form.Item>
            <Form.Item label="Annual household income">
              <InputNumber
                style={{ width: '100%' }}
                prefix="$"
                min={0}
                value={assumptions.annualHouseholdIncome ?? undefined}
                onChange={(val) =>
                  updateAssumptions({ annualHouseholdIncome: typeof val === 'number' ? val : null })
                }
                placeholder="Optional"
              />
            </Form.Item>
            <Form.Item label="Household size">
              <InputNumber
                style={{ width: '100%' }}
                min={1}
                max={20}
                value={assumptions.householdSize ?? undefined}
                onChange={(val) =>
                  updateAssumptions({ householdSize: typeof val === 'number' ? val : null })
                }
                placeholder="Optional"
              />
            </Form.Item>

            <Alert
              type="info"
              showIcon
              message="Spending assumptions"
              description="Sales and excise tax estimates use average spending patterns by default. You can optionally override with an annual taxable spending estimate."
              style={{ marginBottom: 12 }}
            />
            <Form.Item label="Annual taxable spending">
              <InputNumber
                style={{ width: '100%' }}
                prefix="$"
                min={0}
                value={assumptions.annualTaxableSpending ?? undefined}
                onChange={(val) =>
                  updateAssumptions({ annualTaxableSpending: typeof val === 'number' ? val : null })
                }
                placeholder="Optional"
              />
            </Form.Item>

            {(assumptions.payType === 'w2' || assumptions.payType === 'mixed_unsure') && (
              <Form.Item>
                <Space>
                  <Switch
                    checked={assumptions.showEmployerSideTaxes}
                    onChange={(checked) =>
                      updateAssumptions({ showEmployerSideTaxes: checked })
                    }
                  />
                  <Text>Show employer-side taxes (hidden)</Text>
                </Space>
              </Form.Item>
            )}
          </Form>

          <Alert
            type="warning"
            showIcon
            message="No predictions"
            description="TaxAtlas does not predict future policy outcomes. Proposed items are labeled as SIGNAL."
          />
        </Space>
      </Drawer>
    </div>
  );
}

type PayrollPayerBucket = 'Employee-paid' | 'Employer-paid' | 'Shared/Program fees';

interface PayrollLineItem {
  key: string;
  program: string;
  payer: PayrollPayerBucket;
  rate: string;
  annualAmount: number | null;
  dataType: DataType;
  source: SourceReference | null;
  sourceTbd: boolean;
}

interface PayrollModel {
  payType: PayType;
  wageBaseUsed: number | null;
  showEmployerSide: boolean;
  employeeTotal: number | null;
  employerTotal: number | null;
  sharedTotal: number | null;
  items: PayrollLineItem[];
  notes: string[];
}

function buildPayrollModel(assumptions: UserAssumptions): PayrollModel {
  const showEmployerSide = assumptions.showEmployerSideTaxes;
  const payType = assumptions.payType;

  const wage = assumptions.annualW2WageIncome ?? null;
  const w2Relevant = payType === 'w2' || payType === 'mixed_unsure';

  const ssWageBase = 168_600;
  const ssRate = 0.062;
  const medicareRate = 0.0145;

  const safeMin = (a: number, b: number) => (a < b ? a : b);
  const ssTaxableWage = wage !== null ? safeMin(wage, ssWageBase) : null;

  const employeeSS = ssTaxableWage !== null ? ssTaxableWage * ssRate : null;
  const employeeMedicare = wage !== null ? wage * medicareRate : null;

  const employerSS = employeeSS;
  const employerMedicare = employeeMedicare;

  const baseItems: PayrollLineItem[] = [
    {
      key: 'ss-employee',
      program: 'Social Security (OASDI)',
      payer: 'Employee-paid',
      rate: '6.2% (up to wage base)',
      annualAmount: employeeSS,
      dataType: 'estimate',
      source: null,
      sourceTbd: true,
    },
    {
      key: 'medicare-employee',
      program: 'Medicare',
      payer: 'Employee-paid',
      rate: '1.45%',
      annualAmount: employeeMedicare,
      dataType: 'estimate',
      source: null,
      sourceTbd: true,
    },
    {
      key: 'ss-employer',
      program: 'Social Security (OASDI)',
      payer: 'Employer-paid',
      rate: '6.2% (up to wage base)',
      annualAmount: employerSS,
      dataType: 'estimate',
      source: null,
      sourceTbd: true,
    },
    {
      key: 'medicare-employer',
      program: 'Medicare',
      payer: 'Employer-paid',
      rate: '1.45%',
      annualAmount: employerMedicare,
      dataType: 'estimate',
      source: null,
      sourceTbd: true,
    },
    {
      key: 'futa',
      program: 'Federal unemployment (FUTA)',
      payer: 'Employer-paid',
      rate: 'TBD',
      annualAmount: null,
      dataType: 'estimate',
      source: null,
      sourceTbd: true,
    },
    {
      key: 'suta-mn',
      program: 'Minnesota unemployment (SUTA/UI)',
      payer: 'Employer-paid',
      rate: 'TBD',
      annualAmount: null,
      dataType: 'estimate',
      source: null,
      sourceTbd: true,
    },
    {
      key: 'mn-paid-leave',
      program: 'Minnesota paid leave',
      payer: 'Shared/Program fees',
      rate: 'TBD',
      annualAmount: null,
      dataType: 'estimate',
      source: null,
      sourceTbd: true,
    },
    {
      key: 'workforce-fees',
      program: 'Workforce programs & fees',
      payer: 'Shared/Program fees',
      rate: 'TBD',
      annualAmount: null,
      dataType: 'estimate',
      source: null,
      sourceTbd: true,
    },
  ];

  const seIncome = assumptions.annual1099Income ?? null;
  const seTaxable = seIncome !== null ? safeMin(seIncome, ssWageBase) : null;
  const seSS = seTaxable !== null ? seTaxable * (ssRate * 2) : null;
  const seMedicare = seIncome !== null ? seIncome * (medicareRate * 2) : null;

  const notes: string[] = [];
  if (w2Relevant) {
    notes.push('Some employer-paid taxes may not appear on your pay stub.');
    notes.push('Additional Medicare tax, filing status, and deductions are not modeled here.');
  } else if (payType === 'contractor_1099' || payType === 'self_employed') {
    notes.push('Contractors/self-employed filers may pay both sides via self-employment taxes.');
    notes.push('Deductions/credits and filing status are not modeled here.');
  }

  const items: PayrollLineItem[] = w2Relevant
    ? baseItems.filter((it) =>
        it.payer === 'Employer-paid' ? showEmployerSide : true
      )
    : [
        {
          key: 'se-ss',
          program: 'Self-employment tax (Social Security portion)',
          payer: 'Employee-paid',
          rate: '12.4% (up to wage base)',
          annualAmount: seSS,
          dataType: 'estimate',
          source: null,
          sourceTbd: true,
        },
        {
          key: 'se-medicare',
          program: 'Self-employment tax (Medicare portion)',
          payer: 'Employee-paid',
          rate: '2.9%',
          annualAmount: seMedicare,
          dataType: 'estimate',
          source: null,
          sourceTbd: true,
        },
      ];

  const sum = (vals: Array<number | null>) => {
    const present = vals.filter((v): v is number => typeof v === 'number');
    if (present.length === 0) return null;
    return present.reduce((a, b) => a + b, 0);
  };

  const employeeTotal = sum(items.filter((i) => i.payer === 'Employee-paid').map((i) => i.annualAmount));
  const employerTotal = sum(items.filter((i) => i.payer === 'Employer-paid').map((i) => i.annualAmount));
  const sharedTotal = sum(items.filter((i) => i.payer === 'Shared/Program fees').map((i) => i.annualAmount));

  return {
    payType,
    wageBaseUsed: wage,
    showEmployerSide: showEmployerSide && w2Relevant,
    employeeTotal,
    employerTotal,
    sharedTotal,
    items,
    notes,
  };
}

function PayrollSection({
  assumptions,
  model,
  apiBreakdown,
}: {
  assumptions: UserAssumptions;
  model: PayrollModel;
  apiBreakdown: PayrollBreakdown | null;
}) {
  const isW2Context = assumptions.payType === 'w2' || assumptions.payType === 'mixed_unsure';
  const hasInputForContext =
    (isW2Context && typeof assumptions.annualW2WageIncome === 'number') ||
    (!isW2Context && typeof assumptions.annual1099Income === 'number');

  const title = isW2Context ? 'Payroll taxes and employer-side contributions' : 'Payroll taxes';

  // If API returned a breakdown, convert it to our display format
  const useApiData = apiBreakdown !== null;
  const apiItems: PayrollLineItem[] = useApiData
    ? [
        ...apiBreakdown.employeePaid.items.map((item) => ({
          key: `api-employee-${item.instrumentId}`,
          program: item.instrumentName,
          payer: 'Employee-paid' as PayrollPayerBucket,
          rate: `${(item.rate * 100).toFixed(2)}%${item.wageBase ? ` (up to $${item.wageBase.toLocaleString()})` : ''}`,
          annualAmount: item.amount,
          dataType: item.dataType,
          source: item.source,
          sourceTbd: false,
        })),
        ...apiBreakdown.employerPaid.items.map((item) => ({
          key: `api-employer-${item.instrumentId}`,
          program: item.instrumentName,
          payer: 'Employer-paid' as PayrollPayerBucket,
          rate: `${(item.rate * 100).toFixed(2)}%${item.wageBase ? ` (up to $${item.wageBase.toLocaleString()})` : ''}`,
          annualAmount: item.amount,
          dataType: item.dataType,
          source: item.source,
          sourceTbd: false,
        })),
        ...apiBreakdown.programFees.items.map((item) => ({
          key: `api-program-${item.instrumentId}-${item.payer}`,
          program: item.instrumentName,
          payer: 'Shared/Program fees' as PayrollPayerBucket,
          rate: `${(item.rate * 100).toFixed(2)}%${item.wageBase ? ` (up to $${item.wageBase.toLocaleString()})` : ''}`,
          annualAmount: item.amount,
          dataType: item.dataType,
          source: item.source,
          sourceTbd: false,
        })),
      ]
    : [];

  const displayItems = useApiData ? apiItems : model.items;
  const employeeTotal = useApiData ? apiBreakdown.totalEmployeePaid : model.employeeTotal;
  const employerTotal = useApiData ? apiBreakdown.totalEmployerPaid : model.employerTotal;
  const sharedTotal = useApiData ? apiBreakdown.programFees.total : model.sharedTotal;
  const displayNotes = useApiData ? (apiBreakdown.notes ?? []) : model.notes;

  const columns = [
    {
      title: 'Program',
      dataIndex: 'program',
      key: 'program',
      render: (name: string, record: PayrollLineItem) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.rate}</Text>
        </Space>
      ),
    },
    {
      title: 'Who pays',
      dataIndex: 'payer',
      key: 'payer',
      render: (payer: PayrollPayerBucket) => {
        const color =
          payer === 'Employee-paid' ? 'blue' : payer === 'Employer-paid' ? 'purple' : 'gold';
        return <Tag color={color}>{payer}</Tag>;
      },
    },
    {
      title: 'Data',
      dataIndex: 'dataType',
      key: 'dataType',
      render: (_: any, record: PayrollLineItem) => (
        <Space size="small">
          <DataTypeBadge dataType={record.dataType} size="small" showLabel={false} />
          {record.sourceTbd && (
            <Tooltip title="Source not ingested yet. Value is treated as an estimate until the official source is linked.">
              <WarningOutlined style={{ color: colors.dataType.estimate }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Annual amount',
      dataIndex: 'annualAmount',
      key: 'annualAmount',
      align: 'right' as const,
      render: (val: number | null) =>
        val === null ? <Text type="secondary">—</Text> : <Text>{formatCurrency(val, { decimals: 0 })}</Text>,
    },
    {
      title: 'Source',
      key: 'source',
      render: (_: any, record: PayrollLineItem) =>
        record.source ? (
          <SourceLink source={record.source} label="" size="small" />
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Source: TBD
          </Text>
        ),
    },
  ];

  return (
    <Card>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space direction="vertical" size={0}>
          <Space>
            <Title level={4} style={{ marginBottom: 0 }}>
              {title}
            </Title>
            <Tooltip title="Some employer-paid taxes are paid by your employer on your behalf and may not appear in your paycheck.">
              <InfoCircleOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />
            </Tooltip>
          </Space>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Some taxes are paid by your employer on your behalf and may not appear in your paycheck.
          </Text>
        </Space>

        {isW2Context && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Toggle “Show employer-side taxes (hidden)” in the Income & Pay Type panel or “Edit assumptions” to include employer-paid items.
          </Text>
        )}

        {!hasInputForContext && (
          <Alert
            type="warning"
            showIcon
            message="Add income to estimate payroll amounts"
            description={isW2Context ? 'Enter annual W-2 wage income to estimate payroll taxes.' : 'Enter annual 1099 income to estimate self-employment taxes.'}
          />
        )}

        {useApiData && (
          <Alert
            type="success"
            showIcon
            message="Payroll computed from official sources"
            description={`Based on ${apiBreakdown.assumptions.wagesAnnual.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} annual wages.`}
            style={{ marginBottom: 16 }}
          />
        )}

        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Statistic
              title="Employee-paid"
              value={employeeTotal ?? undefined}
              formatter={(v) => formatCurrency(v as number, { decimals: 0 })}
              valueStyle={{ fontSize: 20 }}
              prefix={<DollarOutlined />}
            />
          </Col>
          <Col xs={24} md={8}>
            <Statistic
              title="Employer-paid"
              value={employerTotal ?? undefined}
              formatter={(v) => formatCurrency(v as number, { decimals: 0 })}
              valueStyle={{ fontSize: 20 }}
              prefix={<DollarOutlined />}
            />
          </Col>
          <Col xs={24} md={8}>
            <Statistic
              title="Shared / program fees"
              value={sharedTotal ?? undefined}
              formatter={(v) => formatCurrency(v as number, { decimals: 0 })}
              valueStyle={{ fontSize: 20 }}
              prefix={<DollarOutlined />}
            />
          </Col>
        </Row>

        <Table
          dataSource={displayItems}
          columns={columns as any}
          rowKey="key"
          size="small"
          pagination={false}
        />

        {displayNotes.length > 0 && (
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Notes:
            </Text>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              {displayNotes.map((n) => (
                <li key={n}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {n}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Space>
    </Card>
  );
}

// Tax Category Card with breakdown
function TaxCategoryCard({ category }: { category: TaxCategoryDetail }) {
  const [expanded, setExpanded] = useState(false);

  // Jurisdiction breakdown table columns
  const columns = [
    {
      title: 'Jurisdiction',
      dataIndex: 'jurisdictionName',
      key: 'jurisdictionName',
      render: (name: string, record: any) => (
        <Space>
          <JurisdictionTag type={record.jurisdictionType} name={name} />
        </Space>
      ),
    },
    {
      title: 'Rate',
      dataIndex: 'currentRate',
      key: 'currentRate',
      render: (rate: number | null, record: any) => (
        <Text>{formatRate(rate, record.rateUnit)}</Text>
      ),
    },
    {
      title: 'Data',
      dataIndex: 'dataType',
      key: 'dataType',
      render: (dataType: string) => (
        <DataTypeBadge dataType={dataType as any} showLabel={false} size="small" />
      ),
    },
    {
      title: 'Source',
      key: 'source',
      render: (_: any, record: any) => (
        <SourceLink source={record.source} label="" size="small" />
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <span>{category.displayName}</span>
          <DataTypeBadge dataType={category.dataType} size="small" />
        </Space>
      }
      extra={
        <Text strong style={{ fontSize: 18 }}>
          {formatRate(category.totalRate, category.rateUnit)}
        </Text>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Trend Chart */}
        {category.trendData.length > 1 && (
          <TrendChart
            data={category.trendData}
            rateUnit={category.rateUnit}
            changePercent={category.changePercent}
            changeDirection={category.changeDirection}
            height={180}
            color={getJurisdictionColor(
              category.jurisdictions[0]?.jurisdictionType ?? 'city'
            )}
          />
        )}

        {/* Jurisdiction Breakdown */}
        <Collapse
          ghost
          onChange={(keys) => setExpanded(keys.length > 0)}
          items={[
            {
              key: 'breakdown',
              label: (
                <Space>
                  <DownOutlined
                    style={{
                      transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  />
                  <Text>
                    {category.jurisdictions.length} jurisdiction breakdown
                  </Text>
                </Space>
              ),
              children: (
                <Table
                  dataSource={category.jurisdictions}
                  columns={columns}
                  rowKey="instrumentId"
                  size="small"
                  pagination={false}
                />
              ),
            },
          ]}
        />

        {/* Property Tax Context */}
        {category.propertyContext && category.propertyContext.length > 0 && (
          <>
            <Divider style={{ margin: '8px 0' }} />
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Median Bill"
                  value={category.propertyContext[0].medianBillAmount ?? undefined}
                  formatter={(val) => formatCurrency(val as number)}
                  valueStyle={{ fontSize: 16 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="25th Percentile"
                  value={category.propertyContext[0].billP25Amount ?? undefined}
                  formatter={(val) => formatCurrency(val as number)}
                  valueStyle={{ fontSize: 16 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="75th Percentile"
                  value={category.propertyContext[0].billP75Amount ?? undefined}
                  formatter={(val) => formatCurrency(val as number)}
                  valueStyle={{ fontSize: 16 }}
                />
              </Col>
            </Row>
          </>
        )}
      </Space>
    </Card>
  );
}
