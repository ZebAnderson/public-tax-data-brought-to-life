'use client';

/**
 * Source Link Component
 * Clickable link that opens the source drawer
 */

import React from 'react';
import { Button, Tooltip } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { useSourceDrawer } from '../providers';
import type { SourceReference } from '@/types';

interface SourceLinkProps {
  source: SourceReference;
  label?: string;
  size?: 'small' | 'middle' | 'large';
}

export function SourceLink({ source, label = 'Source', size = 'small' }: SourceLinkProps) {
  const { openSource } = useSourceDrawer();

  return (
    <Tooltip title="View source information">
      <Button
        type="link"
        size={size}
        icon={<FileTextOutlined />}
        onClick={() => openSource(source)}
        style={{ padding: '0 4px' }}
        aria-label={`View source: ${source.title || 'Source document'}`}
      >
        {label}
      </Button>
    </Tooltip>
  );
}
