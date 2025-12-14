'use client';

/**
 * Jurisdiction Tag Component
 * Colored tag for jurisdiction type
 */

import React from 'react';
import { Tag, Tooltip } from 'antd';
import { getJurisdictionColor } from '@/styles/tokens';
import { formatJurisdictionType } from '@/lib/formatters';
import type { JurisdictionType } from '@/types';

interface JurisdictionTagProps {
  type: JurisdictionType;
  name?: string;
  showType?: boolean;
}

export function JurisdictionTag({
  type,
  name,
  showType = false,
}: JurisdictionTagProps) {
  const color = getJurisdictionColor(type);
  const displayText = name || formatJurisdictionType(type);

  return (
    <Tooltip title={showType ? undefined : formatJurisdictionType(type)}>
      <Tag color={color} style={{ margin: 0 }}>
        {showType && `${formatJurisdictionType(type)}: `}
        {displayText}
      </Tag>
    </Tooltip>
  );
}
