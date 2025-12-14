'use client';

/**
 * Income & Pay Type Panel
 * Helps explain visible vs hidden payroll taxes and captures optional inputs.
 */

import React from 'react';
import { Card, Collapse, Segmented, Space, Typography, InputNumber, Switch, Tooltip, Alert } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useUserAssumptions } from '@/components/providers';
import type { PayType } from '@/types';

const { Text, Paragraph } = Typography;

const PAY_TYPE_OPTIONS: Array<{ value: PayType; label: string }> = [
  { value: 'w2', label: 'W-2 employee' },
  { value: 'contractor_1099', label: '1099 / contractor' },
  { value: 'self_employed', label: 'Self-employed' },
  { value: 'mixed_unsure', label: 'Mixed / unsure' },
];

export function IncomePayTypePanel() {
  const { assumptions, setPayType, updateAssumptions } = useUserAssumptions();

  const showEmployerToggle = assumptions.payType === 'w2' || assumptions.payType === 'mixed_unsure';

  return (
    <Card styles={{ body: { padding: 0 } }}>
      <Collapse
        defaultActiveKey={['income-pay-type']}
        items={[
          {
            key: 'income-pay-type',
            label: (
              <Space>
                <Text strong>Income & Pay Type</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Understand visible vs hidden taxes
                </Text>
              </Space>
            ),
            children: (
              <div style={{ padding: 16 }}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    Some taxes are paid by your employer on your behalf and may not appear in your paycheck.
                  </Paragraph>

                  <Space wrap align="center">
                    <Space>
                      <Text strong>Pay type</Text>
                      <Tooltip
                        title={
                          'Many W-2 workers see only their withholding. Employers often pay additional payroll taxes that may not appear on a pay stub.'
                        }
                      >
                        <InfoCircleOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />
                      </Tooltip>
                    </Space>
                    <Segmented
                      options={PAY_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                      value={assumptions.payType}
                      onChange={(value) => setPayType(value as PayType)}
                    />
                  </Space>

                  <Card size="small" style={{ background: 'rgba(0,0,0,0.02)' }}>
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <Text strong>Optional inputs</Text>
                      <Space wrap>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Annual wage income (W-2)
                          </Text>
                          <br />
                          <InputNumber
                            style={{ width: 220 }}
                            prefix="$"
                            min={0}
                            value={assumptions.annualW2WageIncome ?? undefined}
                            onChange={(val) =>
                              updateAssumptions({ annualW2WageIncome: typeof val === 'number' ? val : null })
                            }
                            placeholder="Optional"
                          />
                        </div>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Annual 1099 income
                          </Text>
                          <br />
                          <InputNumber
                            style={{ width: 220 }}
                            prefix="$"
                            min={0}
                            value={assumptions.annual1099Income ?? undefined}
                            onChange={(val) =>
                              updateAssumptions({ annual1099Income: typeof val === 'number' ? val : null })
                            }
                            placeholder="Optional"
                          />
                        </div>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Annual household income
                          </Text>
                          <br />
                          <InputNumber
                            style={{ width: 220 }}
                            prefix="$"
                            min={0}
                            value={assumptions.annualHouseholdIncome ?? undefined}
                            onChange={(val) =>
                              updateAssumptions({ annualHouseholdIncome: typeof val === 'number' ? val : null })
                            }
                            placeholder="Optional"
                          />
                        </div>
                      </Space>
                      {showEmployerToggle && (
                        <Space>
                          <Switch
                            checked={assumptions.showEmployerSideTaxes}
                            onChange={(checked) =>
                              updateAssumptions({ showEmployerSideTaxes: checked })
                            }
                          />
                          <Text>Show employer-side taxes (hidden)</Text>
                        </Space>
                      )}
                    </Space>
                  </Card>

                  {assumptions.payType === 'contractor_1099' && (
                    <Alert
                      type="info"
                      showIcon
                      message="1099 / contractor"
                      description="Contractors often pay both the worker and employer-equivalent portions themselves (e.g., self-employment tax)."
                    />
                  )}

                  {assumptions.payType === 'self_employed' && (
                    <Alert
                      type="info"
                      showIcon
                      message="Self-employed"
                      description="Self-employed filers often pay self-employment taxes that cover both sides of certain payroll taxes."
                    />
                  )}
                </Space>
              </div>
            ),
          },
        ]}
      />
    </Card>
  );
}

