'use client';

/**
 * Map Preview Component
 * Shows a small map preview with bbox or centroid
 * Uses Leaflet when available, falls back to text display
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
// Import Leaflet CSS directly in client component to ensure it's loaded
import 'leaflet/dist/leaflet.css';
import { Card, Typography, Space, Modal } from 'antd';
import { EnvironmentOutlined, ExpandOutlined, FullscreenExitOutlined } from '@ant-design/icons';
import type { BBox, GeoPoint } from '@/types';
import { colors } from '@/styles/tokens';

const { Text } = Typography;

interface MapPreviewProps {
  bbox: BBox | null;
  centroid: GeoPoint | null;
  name?: string;
  height?: number;
  showExpand?: boolean;
}

type LeafletMap = any;
type Leaflet = any;

export function MapPreview({
  bbox,
  centroid,
  name,
  height = 200,
  showExpand = false,
}: MapPreviewProps) {
  const [L, setL] = useState<Leaflet | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const fullscreenMapRef = useRef<LeafletMap | null>(null);
  const rectangleRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    // Dynamically import Leaflet on client side
    Promise.all([
      import('leaflet'),
    ])
      .then(([leaflet]) => {
        if (cancelled) return;

        const leafletLib = leaflet.default ?? leaflet;

        const g = globalThis as any;
        if (!g.__taxatlas_leaflet_icons_patched) {
          g.__taxatlas_leaflet_icons_patched = true;
          try {
            const iconProto = (leafletLib.Icon?.Default?.prototype ?? {}) as any;
            delete iconProto._getIconUrl;
          } catch {
            // ignore
          }
          leafletLib.Icon.Default.mergeOptions({
            iconRetinaUrl: '/images/marker-icon-2x.png',
            iconUrl: '/images/marker-icon.png',
            shadowUrl: '/images/marker-shadow.png',
          });
        }

        setL(leafletLib);
      })
      .catch(() => {
        // Leaflet not available, use fallback
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Calculate center and bounds
  const center: [number, number] | null = centroid
    ? [centroid.coordinates[1], centroid.coordinates[0]]
    : bbox
    ? [(bbox[1] + bbox[3]) / 2, (bbox[0] + bbox[2]) / 2]
    : null;

  const bounds: [[number, number], [number, number]] | null = bbox
    ? [
        [bbox[1], bbox[0]],
        [bbox[3], bbox[2]],
      ]
    : null;

  // Used for view updates and React Fast Refresh safety.
  const mapKey = useMemo(() => {
    if (center) {
      return `map-${center[0].toFixed(6)}-${center[1].toFixed(6)}`;
    }
    return 'map-no-center';
  }, [center]);

  const boundsKey = useMemo(() => {
    if (!bbox) return 'no-bounds';
    return `bounds-${bbox.map((n) => Number(n).toFixed(6)).join('-')}`;
  }, [bbox]);

  const centroidKey = useMemo(() => {
    if (!centroid) return 'no-centroid';
    return `centroid-${centroid.coordinates[1].toFixed(6)}-${centroid.coordinates[0].toFixed(6)}`;
  }, [centroid]);

  // Imperative Leaflet init + update. React Leaflet can throw "Map container already initialized"
  // under Strict Mode / Fast Refresh; this implementation does explicit cleanup.
  useEffect(() => {
    if (!L) return;
    if (!center) return;
    if (!containerRef.current) return;

    const container = containerRef.current as any;

     const cleanupContainer = (el: any) => {
       if (!el) return;
       if (el?.innerHTML !== undefined) {
         try {
           el.innerHTML = '';
         } catch {
           // ignore
         }
       }
       if (el?._leaflet_id) {
         try {
           delete el._leaflet_id;
         } catch {
           // ignore
         }
         try {
           el._leaflet_id = null;
         } catch {
           // ignore
         }
       }
     };

     const teardownMap = (map: LeafletMap | null) => {
       if (!map) return;

       try {
         rectangleRef.current?.remove?.();
       } catch {
         // ignore
       }
       try {
         markerRef.current?.remove?.();
       } catch {
         // ignore
       }

       rectangleRef.current = null;
       markerRef.current = null;

       const mapContainer = map.getContainer?.() ?? (map as any)?._container;
       try {
         map.remove();
       } catch {
         // ignore
       }

       cleanupContainer(mapContainer);
       mapRef.current = null;
     };

     // If the map exists but is bound to a different DOM node (e.g. key remount),
     // tear it down so we can safely recreate it on the current container.
     if (mapRef.current) {
       const existingContainer =
         mapRef.current.getContainer?.() ?? (mapRef.current as any)?._container;
       if (existingContainer && existingContainer !== container) {
         teardownMap(mapRef.current);
       }
     }

    // If the DOM node is "poisoned" from a previous map instance (Fast Refresh), clear it.
    if (!mapRef.current) cleanupContainer(container);

    if (!mapRef.current) {
      try {
        mapRef.current = L.map(containerRef.current, {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: false,
          dragging: false,
          doubleClickZoom: false,
          boxZoom: false,
          keyboard: false,
          tap: false,
          touchZoom: false,
        });
      } catch {
        // One more attempt after a full cleanup (handles Fast Refresh + stale Leaflet state).
        cleanupContainer(containerRef.current as any);
        try {
          mapRef.current = L.map(containerRef.current, {
            zoomControl: false,
            attributionControl: false,
            scrollWheelZoom: false,
            dragging: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            tap: false,
            touchZoom: false,
          });
        } catch {
          teardownMap(mapRef.current);
          return;
        }
      }

      if (mapRef.current) {
        // Use OpenStreetMap tiles as they're most reliable
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(mapRef.current);
      }
    }

    // View
    if (!mapRef.current) return;
    if (bounds) {
      mapRef.current.fitBounds(bounds, { padding: [12, 12], animate: false });
    } else {
      mapRef.current.setView(center, 13, { animate: false });
    }

    // Overlay: bounds rectangle
    if (bounds) {
      if (!rectangleRef.current) {
        rectangleRef.current = L.rectangle(bounds, {
          color: colors.primary,
          weight: 2,
          fillColor: colors.primary,
          fillOpacity: 0.1,
        }).addTo(mapRef.current);
      } else {
        rectangleRef.current.setBounds(bounds);
      }
    } else if (rectangleRef.current) {
      rectangleRef.current.remove();
      rectangleRef.current = null;
    }

    // Overlay: centroid marker
    if (centroid) {
      if (!markerRef.current) {
        markerRef.current = L.marker(center).addTo(mapRef.current);
      } else {
        markerRef.current.setLatLng(center);
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    // Ensure tiles render correctly if the container resized.
    // Use setTimeout to ensure container is fully rendered in the DOM
    const map = mapRef.current;
    setTimeout(() => {
      if (map && map.getContainer()) {
        map.invalidateSize({ animate: false });
      }
    }, 100);
  }, [L, mapKey, boundsKey, centroidKey]);

  // Cleanup on unmount - store container ref in a variable to access in cleanup
  useEffect(() => {
    const container = containerRef.current;

    return () => {
      // Clear overlays first
      try {
        rectangleRef.current?.remove?.();
      } catch {
        // ignore
      }
      try {
        markerRef.current?.remove?.();
      } catch {
        // ignore
      }
      rectangleRef.current = null;
      markerRef.current = null;

      // Remove map
      const map = mapRef.current;
      mapRef.current = null;

      if (map) {
        try {
          map.remove();
        } catch {
          // ignore
        }
      }

      // Clean container
      if (container) {
        if ((container as any)?.innerHTML !== undefined) {
          try {
            (container as any).innerHTML = '';
          } catch {
            // ignore
          }
        }
        if ((container as any)?._leaflet_id) {
          try {
            delete (container as any)._leaflet_id;
          } catch {
            (container as any)._leaflet_id = null;
          }
        }
      }
    };
  }, []);

  // Fullscreen map initialization
  useEffect(() => {
    if (!L || !isFullscreen || !center) return;
    if (!fullscreenContainerRef.current) return;

    // Small delay to ensure modal is rendered
    const timeout = setTimeout(() => {
      if (!fullscreenContainerRef.current) return;

      // Clean up any existing map
      if (fullscreenMapRef.current) {
        try {
          fullscreenMapRef.current.remove();
        } catch {
          // ignore
        }
        fullscreenMapRef.current = null;
      }

      // Clean container
      const container = fullscreenContainerRef.current as any;
      if (container?._leaflet_id) {
        try {
          delete container._leaflet_id;
        } catch {
          container._leaflet_id = null;
        }
      }

      try {
        fullscreenMapRef.current = L.map(fullscreenContainerRef.current, {
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: true,
          dragging: true,
          doubleClickZoom: true,
        });

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(fullscreenMapRef.current);

        // Set view
        if (bounds) {
          fullscreenMapRef.current.fitBounds(bounds, { padding: [20, 20], animate: false });
        } else {
          fullscreenMapRef.current.setView(center, 14, { animate: false });
        }

        // Add rectangle overlay
        if (bounds) {
          L.rectangle(bounds, {
            color: colors.primary,
            weight: 2,
            fillColor: colors.primary,
            fillOpacity: 0.1,
          }).addTo(fullscreenMapRef.current);
        }

        // Add marker
        if (centroid) {
          L.marker(center).addTo(fullscreenMapRef.current);
        }

        // Invalidate size
        setTimeout(() => {
          fullscreenMapRef.current?.invalidateSize({ animate: false });
        }, 100);
      } catch {
        // ignore initialization errors
      }
    }, 100);

    return () => {
      clearTimeout(timeout);
      if (fullscreenMapRef.current) {
        try {
          fullscreenMapRef.current.remove();
        } catch {
          // ignore
        }
        fullscreenMapRef.current = null;
      }
    };
  }, [L, isFullscreen, center, bounds, centroid]);

  // If no location data, show placeholder
  if (!center) {
    return (
      <Card
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: colors.neutral.bg,
        }}
      >
        <Space direction="vertical" align="center">
          <EnvironmentOutlined
            style={{ fontSize: 32, color: colors.neutral.textTertiary }}
          />
          <Text type="secondary">No location data</Text>
        </Space>
      </Card>
    );
  }

  // Leaflet map
  if (L) {
    return (
      <div style={{ height, borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
        <div
          ref={containerRef}
          style={{ height: '100%', width: '100%' }}
        />

        {/* Name overlay */}
        {name && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              background: 'rgba(255, 255, 255, 0.9)',
              padding: '4px 8px',
              borderRadius: 4,
              zIndex: 1000,
            }}
          >
            <Text strong style={{ fontSize: 12 }}>
              {name}
            </Text>
          </div>
        )}

        {/* Expand button */}
        {showExpand && (
          <div
            onClick={() => setIsFullscreen(true)}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'rgba(255, 255, 255, 0.9)',
              padding: '4px 8px',
              borderRadius: 4,
              zIndex: 1000,
              cursor: 'pointer',
            }}
          >
            <ExpandOutlined style={{ color: colors.primary }} />
          </div>
        )}

        {/* Fullscreen Modal */}
        <Modal
          open={isFullscreen}
          onCancel={() => setIsFullscreen(false)}
          footer={null}
          width="90vw"
          style={{ top: 20 }}
          styles={{ body: { height: '80vh', padding: 0 } }}
          title={name || 'Map View'}
          closeIcon={<FullscreenExitOutlined />}
        >
          <div
            ref={fullscreenContainerRef}
            style={{ height: '100%', width: '100%' }}
          />
        </Modal>
      </div>
    );
  }

  // Fallback: text-based display
  return (
    <Card
      style={{
        height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.neutral.bg,
      }}
    >
      <Space direction="vertical" align="center" size="small">
        <EnvironmentOutlined
          style={{ fontSize: 32, color: colors.primary }}
        />
        {name && <Text strong>{name}</Text>}
        <Text type="secondary" style={{ fontSize: 12 }}>
          {center[0].toFixed(4)}°N, {Math.abs(center[1]).toFixed(4)}°W
        </Text>
        {bbox && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            Bounds: [{bbox.map((n) => n.toFixed(3)).join(', ')}]
          </Text>
        )}
      </Space>
    </Card>
  );
}
