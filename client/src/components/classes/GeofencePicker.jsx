import { useEffect, useRef, useState, useMemo }      from 'react';
import {
  MapContainer, TileLayer, Marker, Circle,
  useMapEvents, useMap,
}                                                    from 'react-leaflet';
import L                                             from 'leaflet';
import { motion, AnimatePresence }                   from 'framer-motion';
import {
  MapPin, Crosshair, AlertCircle, Search, X,
  Loader2, CheckCircle, Building2, Trash2, Wifi,
}                                                    from 'lucide-react';

import {
  EASE, DURATION, SPRING, TAP,
}                                                    from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * GeofencePicker — interactive map with progressive GPS refinement
 * and address search.
 *
 * Three ways to set the geofence centre:
 *   1. Click on the map
 *   2. "Use my location" — uses watchPosition for progressive
 *      accuracy (fast first fix, then refines as better readings
 *      arrive). Shows a live accuracy circle that shrinks.
 *   3. Address search via Nominatim (OSM's free geocoder)
 *
 * The accuracy circle is the key UX win — lecturers SEE the pin
 * settling onto its true location instead of trusting a single
 * potentially-bad reading. Watch stops automatically once accuracy
 * is under 10m or after 30 seconds.
 *
 * Prop contract preserved:
 *   value:    { lat, lng, radius }
 *   onChange: ({ geo_lat, geo_lng, geo_radius }) => void
 * ═════════════════════════════════════════════════════════════════
 */

// Fix Leaflet's default marker icon — bundlers break the path resolution
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Leaflet divIcon — uses our brand colour and animates with CSS
const BRAND_PIN = L.divIcon({
  className: 'geofence-pin',
  html: `
    <div style="
      width: 28px; height: 28px;
      border-radius: 50% 50% 50% 0;
      background: var(--brand);
      border: 3px solid #fff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transform: rotate(-45deg);
      display: flex; align-items: center; justify-content: center;
    ">
      <div style="
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #fff;
        transform: rotate(45deg);
      "></div>
    </div>
  `,
  iconSize:   [28, 28],
  iconAnchor: [14, 28],
});

// ─── Inner: listens for map clicks ─────────────────────────────
function LocationSelector({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// ─── Inner: smoothly pans/zooms map when position changes ──────
function MapController({ position, accuracy }) {
  const map = useMap();

  useEffect(() => {
    if (!position) return;
    // Pick a zoom level appropriate for the accuracy (tighter pin = more zoom)
    const zoom = accuracy && accuracy > 200
      ? 15
      : accuracy && accuracy > 50
        ? 17
        : 18;
    map.flyTo([position.lat, position.lng], zoom, {
      duration: 0.8,
      easeLinearity: 0.25,
    });
  }, [position?.lat, position?.lng, accuracy, map]);

  return null;
}

export default function GeofencePicker({ value, onChange }) {

  // ── State ────────────────────────────────────────────────────
  const [position, setPosition] = useState(
    value?.lat && value?.lng
      ? { lat: parseFloat(value.lat), lng: parseFloat(value.lng) }
      : null
  );
  const [radius,   setRadius]   = useState(value?.radius ?? 100);

  // GPS state
  const [locating,    setLocating]    = useState(false);
  const [locError,    setLocError]    = useState('');
  const [accuracy,    setAccuracy]    = useState(null);   // metres
  const [refining,    setRefining]    = useState(false);  // first fix arrived, still watching

  // Address search state
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [showResults,   setShowResults]   = useState(false);

  // Refs for the GPS watcher and search debounce
  const watchIdRef       = useRef(null);
  const watchTimeoutRef  = useRef(null);
  const searchTimeoutRef = useRef(null);
  const searchAbortRef   = useRef(null);

  // ── Default centre: Accra, Ghana ─────────────────────────────
  const DEFAULT_CENTER = [5.6037, -0.1870];
  const DEFAULT_ZOOM   = 16;

  // ── Bubble values up to parent ──────────────────────────────
  // Stable onChange via ref so we don't re-fire on every parent re-render
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    onChangeRef.current({
      geo_lat:    position?.lat ?? null,
      geo_lng:    position?.lng ?? null,
      geo_radius: radius,
    });
  }, [position, radius]);

  // ── Cleanup watchers on unmount ─────────────────────────────
  useEffect(() => {
    return () => stopWatching();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopWatching = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (watchTimeoutRef.current) {
      clearTimeout(watchTimeoutRef.current);
      watchTimeoutRef.current = null;
    }
    setLocating(false);
    setRefining(false);
  };

  // ── Map click → set position ────────────────────────────────
  const handleMapClick = (pos) => {
    stopWatching();
    setPosition(pos);
    setAccuracy(null);
    setLocError('');
  };

  // ── "Use my location" — progressive refinement ─────────────
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser');
      return;
    }
    // If already watching, stop and restart
    stopWatching();
    setLocError('');
    setLocating(true);
    setAccuracy(null);

    // Watch position — keep updating as more accurate readings arrive
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy: acc } = pos.coords;
        const newAcc = Math.round(acc);

        setPosition(prev => {
          // Only update if no previous OR new reading is more accurate
          if (!accuracy || newAcc <= accuracy) {
            setAccuracy(newAcc);
            return { lat: latitude, lng: longitude };
          }
          return prev;
        });

        // First fix has arrived — switch from "locating" to "refining"
        setLocating(false);
        setRefining(true);

        // Auto-stop once we hit good accuracy (≤10m)
        if (newAcc <= 10) {
          stopWatching();
        }
      },
      (err) => {
        const msg = err.code === 1
          ? 'Permission denied — please allow location access in your browser settings'
          : err.code === 2
            ? 'Position unavailable — check your network or GPS'
            : err.code === 3
              ? 'Took too long to get your location — please try again or click on the map'
              : 'Could not get your location — please click on the map instead';
        setLocError(msg);
        stopWatching();
      },
      {
        enableHighAccuracy: true,
        timeout:            15_000,
        maximumAge:         0,
      }
    );

    // Hard timeout — stop refining after 30s regardless
    watchTimeoutRef.current = setTimeout(() => {
      stopWatching();
    }, 30_000);
  };

  // ── Address search via Nominatim ────────────────────────────
  const performSearch = async (query) => {
    if (!query || query.trim().length < 3) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    // Cancel any in-flight search
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    searchAbortRef.current = new AbortController();

    setSearching(true);

    try {
      // Nominatim free geocoder — no API key, but we should be polite
      // about request rate. Returns up to 5 results.
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q',      query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit',  '5');
      url.searchParams.set('addressdetails', '1');

      const resp = await fetch(url.toString(), {
        signal: searchAbortRef.current.signal,
        headers: { 'Accept-Language': 'en' },
      });

      if (!resp.ok) throw new Error('Search failed');

      const data = await resp.json();
      setSearchResults(data);
      setShowResults(true);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setSearchResults([]);
      }
    } finally {
      setSearching(false);
    }
  };

  // Debounced search — wait 350ms after typing stops
  const handleSearchChange = (e) => {
    const v = e.target.value;
    setSearchQuery(v);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!v.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(v);
    }, 350);
  };

  const handleSearchSelect = (result) => {
    stopWatching();
    setPosition({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    });
    setAccuracy(null);
    setSearchQuery(result.display_name.split(',')[0]); // short name
    setShowResults(false);
    setSearchResults([]);
    setLocError('');
  };

  const handleSearchClear = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  // ── Clear geofence entirely ─────────────────────────────────
  const handleClear = () => {
    stopWatching();
    setPosition(null);
    setAccuracy(null);
    setLocError('');
  };

  // ── Accuracy quality tier ──────────────────────────────────
  const accuracyTier = useMemo(() => {
    if (accuracy == null) return null;
    if (accuracy <= 10)  return { label: 'Excellent', color: 'var(--green)',  bg: 'var(--green-bg)',  border: 'var(--green-border)'  };
    if (accuracy <= 30)  return { label: 'Good',      color: 'var(--brand)',  bg: 'var(--brand-subtle)', border: 'var(--brand-border)' };
    if (accuracy <= 100) return { label: 'Fair',      color: 'var(--amber)',  bg: 'var(--amber-bg)',  border: 'var(--amber-border)'  };
    return                     { label: 'Poor',      color: 'var(--red)',    bg: 'var(--red-bg)',    border: 'var(--red-border)'    };
  }, [accuracy]);

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           'var(--space-2)',
    }}>

      {/* ── Address search bar ──────────────────────────────── */}
      <div style={{ position: 'relative' }}>
        <Search
          size={14}
          style={{
            position:      'absolute',
            left:          '12px',
            top:           '50%',
            transform:     'translateY(-50%)',
            color:         'var(--text-muted)',
            pointerEvents: 'none',
            zIndex:        2,
          }}
        />
        <input
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
          placeholder="Search for an address, building, or landmark…"
          className="input-base"
          style={{
            paddingLeft:  '36px',
            paddingRight: '64px',
          }}
        />

        {/* Loading or clear icon on the right */}
        <div style={{
          position:   'absolute',
          right:      '8px',
          top:        '50%',
          transform:  'translateY(-50%)',
          display:    'flex',
          alignItems: 'center',
          gap:        '4px',
          zIndex:     2,
        }}>
          {searching && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, ease: 'linear', repeat: Infinity }}
              style={{ display: 'flex', color: 'var(--text-muted)' }}
            >
              <Loader2 size={14} />
            </motion.div>
          )}
          {searchQuery && !searching && (
            <motion.button
              whileTap={TAP.button}
              type="button"
              onClick={handleSearchClear}
              aria-label="Clear search"
              style={{
                background:   'none',
                border:       'none',
                cursor:       'pointer',
                color:        'var(--text-muted)',
                padding:      '4px',
                borderRadius: 'var(--radius-atomic)',
                display:      'flex',
                alignItems:   'center',
                transition:   `color ${DURATION.base}ms ${EASE.state}`,
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <X size={14} />
            </motion.button>
          )}
        </div>

        {/* Search results dropdown */}
        <AnimatePresence>
          {showResults && searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{    opacity: 0, y: -4, scale: 0.98 }}
              transition={SPRING.snappy}
              style={{
                position:      'absolute',
                top:           'calc(100% + 4px)',
                left:          0,
                right:         0,
                background:    'var(--bg-card)',
                border:        '1px solid var(--border)',
                borderRadius:  'var(--radius-molecular)',
                boxShadow:     'var(--shadow-lg)',
                zIndex:        10,
                overflow:      'hidden',
                maxHeight:     '280px',
                overflowY:     'auto',
              }}
            >
              {searchResults.map((r, i) => (
                <motion.button
                  key={r.place_id}
                  type="button"
                  whileTap={TAP.button}
                  onClick={() => handleSearchSelect(r)}
                  style={{
                    display:        'flex',
                    alignItems:     'flex-start',
                    gap:            '10px',
                    width:          '100%',
                    padding:        '10px 14px',
                    background:     'transparent',
                    border:         'none',
                    borderBottom:   i < searchResults.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor:         'pointer',
                    textAlign:      'left',
                    fontFamily:     'var(--font-body)',
                    transition:     `background ${DURATION.base}ms ${EASE.state}`,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width:          '28px',
                    height:         '28px',
                    borderRadius:   'var(--radius-atomic)',
                    background:     'var(--brand-subtle)',
                    border:         '1px solid var(--brand-border)',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    flexShrink:     0,
                    color:          'var(--brand-text)',
                    marginTop:      '2px',
                  }}>
                    <Building2 size={13} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      color:        'var(--text-primary)',
                      fontSize:     'var(--text-sm)',
                      fontWeight:   500,
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                    }}>
                      {r.display_name.split(',')[0]}
                    </p>
                    <p style={{
                      color:        'var(--text-muted)',
                      fontSize:     'var(--text-xs)',
                      marginTop:    '2px',
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                    }}>
                      {r.display_name.split(',').slice(1).join(',').trim()}
                    </p>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Action buttons row ─────────────────────────────── */}
      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:        '8px',
        flexWrap:   'wrap',
      }}>
        <motion.button
          whileTap={TAP.button}
          whileHover={!locating && !refining ? { y: -1 } : undefined}
          transition={SPRING.snappy}
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating}
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          '6px',
            padding:      '8px 14px',
            background:   refining ? 'var(--green-bg)'     : 'var(--brand-subtle)',
            border:       `1px solid ${refining ? 'var(--green-border)' : 'var(--brand-border)'}`,
            color:        refining ? 'var(--green)'        : 'var(--brand-text)',
            borderRadius: 'var(--radius-atomic)',
            fontSize:     'var(--text-xs)',
            fontWeight:   600,
            cursor:       locating ? 'not-allowed' : 'pointer',
            opacity:      locating ? 0.7 : 1,
            fontFamily:   'var(--font-body)',
            transition:   `background ${DURATION.base}ms ${EASE.state},
                           color ${DURATION.base}ms ${EASE.state},
                           border-color ${DURATION.base}ms ${EASE.state}`,
          }}
        >
          {locating ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, ease: 'linear', repeat: Infinity }}
              style={{ display: 'flex' }}
            >
              <Loader2 size={13} />
            </motion.span>
          ) : refining ? (
            <motion.span
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity }}
              style={{ display: 'flex' }}
            >
              <Wifi size={13} />
            </motion.span>
          ) : (
            <Crosshair size={13} />
          )}
          {locating ? 'Getting location…' : refining ? 'Refining…' : 'Use my location'}
        </motion.button>

        {refining && (
          <motion.button
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{    opacity: 0, x: -4 }}
            whileTap={TAP.button}
            type="button"
            onClick={stopWatching}
            style={{
              padding:      '8px 12px',
              background:   'var(--bg-raised)',
              border:       '1px solid var(--border)',
              color:        'var(--text-secondary)',
              borderRadius: 'var(--radius-atomic)',
              fontSize:     'var(--text-xs)',
              fontWeight:   600,
              cursor:       'pointer',
              fontFamily:   'var(--font-body)',
            }}
          >
            Stop refining
          </motion.button>
        )}

        <AnimatePresence>
          {position && !locating && !refining && (
            <motion.button
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{    opacity: 0, x: -4 }}
              whileTap={TAP.button}
              whileHover={{ y: -1 }}
              transition={SPRING.snappy}
              type="button"
              onClick={handleClear}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          '6px',
                padding:      '8px 14px',
                background:   'var(--red-bg)',
                border:       '1px solid var(--red-border)',
                color:        'var(--red)',
                borderRadius: 'var(--radius-atomic)',
                fontSize:     'var(--text-xs)',
                fontWeight:   600,
                cursor:       'pointer',
                fontFamily:   'var(--font-body)',
              }}
            >
              <Trash2 size={12} />
              Clear
            </motion.button>
          )}
        </AnimatePresence>

        {/* Accuracy chip — appears once GPS has a fix */}
        <AnimatePresence>
          {accuracyTier && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, x: -4 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{    opacity: 0, scale: 0.8 }}
              transition={SPRING.snappy}
              style={{
                marginLeft:    'auto',
                display:       'flex',
                alignItems:    'center',
                gap:           '6px',
                padding:       '6px 12px',
                background:    accuracyTier.bg,
                border:        `1px solid ${accuracyTier.border}`,
                borderRadius:  'var(--radius-pill)',
                fontSize:      '11px',
                fontFamily:    'var(--font-mono)',
                fontWeight:    600,
                color:         accuracyTier.color,
              }}
            >
              <CheckCircle size={11} />
              <span>±{accuracy}m · {accuracyTier.label}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Helpful hint when no position ───────────────────── */}
      {!position && !locError && !locating && (
        <p style={{
          color:      'var(--text-muted)',
          fontSize:   'var(--text-xs)',
          lineHeight: 1.5,
        }}>
          Click on the map, search for an address, or use your current location to set the geofence centre.
        </p>
      )}

      {/* ── Error message ───────────────────────────────────── */}
      <AnimatePresence>
        {locError && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{    opacity: 0, y: -4, height: 0 }}
            transition={SPRING.snappy}
            style={{
              display:      'flex',
              alignItems:   'flex-start',
              gap:          '8px',
              padding:      '10px 14px',
              background:   'var(--red-bg)',
              border:       '1px solid var(--red-border)',
              borderRadius: 'var(--radius-atomic)',
              color:        'var(--red)',
              fontSize:     'var(--text-xs)',
              lineHeight:   1.5,
            }}
          >
            <AlertCircle size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{locError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Map ─────────────────────────────────────────────── */}
      <div style={{
        position:     'relative',
        borderRadius: 'var(--radius-molecular)',
        overflow:     'hidden',
        border:       '1px solid var(--border)',
        height:       '320px',
        boxShadow:    'var(--shadow-sm)',
      }}>
        <MapContainer
          center={position ? [position.lat, position.lng] : DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <LocationSelector onSelect={handleMapClick} />
          <MapController position={position} accuracy={accuracy} />

          {position && (
            <>
              {/* GPS accuracy circle — only when we have an accuracy reading */}
              {accuracy && accuracy > 5 && (
                <Circle
                  center={[position.lat, position.lng]}
                  radius={accuracy}
                  pathOptions={{
                    color:       refining ? '#10b981' : '#3b82f6',
                    fillColor:   refining ? '#10b981' : '#3b82f6',
                    fillOpacity: 0.06,
                    weight:      1,
                    dashArray:   refining ? '4 4' : null,
                  }}
                />
              )}

              {/* The geofence radius */}
              <Circle
                center={[position.lat, position.lng]}
                radius={radius}
                pathOptions={{
                  color:       '#3b82f6',
                  fillColor:   '#3b82f6',
                  fillOpacity: 0.14,
                  weight:      2,
                }}
              />

              {/* Branded pin */}
              <Marker
                position={[position.lat, position.lng]}
                icon={BRAND_PIN}
              />
            </>
          )}
        </MapContainer>

        {/* "Refining" overlay badge — top-left of map */}
        <AnimatePresence>
          {refining && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{    opacity: 0, y: -8 }}
              transition={SPRING.snappy}
              style={{
                position:       'absolute',
                top:            '12px',
                left:           '12px',
                zIndex:         500,
                display:        'flex',
                alignItems:     'center',
                gap:            '6px',
                padding:        '6px 12px',
                background:     'rgba(16, 185, 129, 0.92)',
                color:          '#fff',
                borderRadius:   'var(--radius-pill)',
                fontSize:       '11px',
                fontWeight:     700,
                fontFamily:     'var(--font-mono)',
                boxShadow:      '0 4px 16px rgba(0,0,0,0.2)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <motion.span
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity }}
                style={{
                  width:        '6px',
                  height:       '6px',
                  borderRadius: 'var(--radius-pill)',
                  background:   '#fff',
                }}
              />
              <span>Refining position…</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Coordinate / no-selection display ───────────────── */}
      <AnimatePresence mode="wait">
        {position ? (
          <motion.div
            key="coords"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: 4 }}
            transition={SPRING.snappy}
            style={{
              display:             'grid',
              gridTemplateColumns: '1fr 1fr',
              gap:                 '8px',
            }}
          >
            <CoordCell label="Latitude"  value={position.lat.toFixed(6)} />
            <CoordCell label="Longitude" value={position.lng.toFixed(6)} />
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: 4 }}
            transition={SPRING.snappy}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          '8px',
              padding:      '10px 14px',
              background:   'var(--bg-raised)',
              border:       '1px dashed var(--border-hover)',
              borderRadius: 'var(--radius-atomic)',
              color:        'var(--text-muted)',
              fontSize:     'var(--text-xs)',
            }}
          >
            <MapPin size={14} />
            No location selected yet
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Radius slider section ───────────────────────────── */}
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           '8px',
        padding:       'var(--space-2)',
        background:    'var(--bg-raised)',
        borderRadius:  'var(--radius-atomic)',
        marginTop:     '4px',
      }}>
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
        }}>
          <label style={{
            color:      'var(--text-secondary)',
            fontWeight: 600,
            fontSize:   'var(--text-xs)',
          }}>
            Geofence radius
          </label>
          <AnimatePresence mode="wait">
            <motion.span
              key={radius}
              initial={{ opacity: 0, scale: 0.85, y: -2 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{    opacity: 0, scale: 0.85, y: 2 }}
              transition={SPRING.snappy}
              style={{
                background:    'var(--brand-subtle)',
                color:         'var(--brand-text)',
                border:        '1px solid var(--brand-border)',
                borderRadius:  'var(--radius-pill)',
                padding:       '2px 10px',
                fontSize:      '11px',
                fontWeight:    700,
                fontFamily:    'var(--font-mono)',
              }}
            >
              {radius}m
            </motion.span>
          </AnimatePresence>
        </div>

        <input
          type="range"
          min={20}
          max={500}
          step={10}
          value={radius}
          onChange={e => setRadius(parseInt(e.target.value))}
          style={{
            width:       '100%',
            accentColor: 'var(--brand)',
            cursor:      'pointer',
          }}
        />

        {/* Preset chips */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[20, 50, 100, 150, 200, 300].map(r => {
            const selected = radius === r;
            return (
              <motion.button
                key={r}
                whileTap={TAP.button}
                type="button"
                onClick={() => setRadius(r)}
                animate={{
                  borderColor:     selected ? 'var(--brand)'        : 'var(--border)',
                  backgroundColor: selected ? 'var(--brand-subtle)' : 'var(--bg-card)',
                  color:           selected ? 'var(--brand-text)'   : 'var(--text-muted)',
                }}
                transition={{ duration: DURATION.base, ease: EASE.state }}
                style={{
                  padding:       '4px 12px',
                  borderRadius:  'var(--radius-pill)',
                  border:        '1px solid',
                  fontSize:      '11px',
                  fontWeight:    selected ? 700 : 500,
                  cursor:        'pointer',
                  fontFamily:    'var(--font-mono)',
                }}
              >
                {r}m
              </motion.button>
            );
          })}
        </div>

        <p style={{
          color:      'var(--text-muted)',
          fontSize:   '11px',
          lineHeight: 1.5,
        }}>
          Students must be within this distance to mark attendance. A typical lecture hall is 20–100m, an outdoor area may need 150–300m.
        </p>
      </div>
    </div>
  );
}

// ─── Coordinate cell ───────────────────────────────────────────
function CoordCell({ label, value }) {
  return (
    <div style={{
      background:   'var(--bg-raised)',
      borderRadius: 'var(--radius-atomic)',
      padding:      '8px 12px',
    }}>
      <p style={{
        color:         'var(--text-muted)',
        fontSize:      '9px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight:    600,
        marginBottom:  '2px',
      }}>
        {label}
      </p>
      <p style={{
        color:         'var(--text-primary)',
        fontSize:      'var(--text-sm)',
        fontFamily:    'var(--font-mono)',
        fontWeight:    600,
        letterSpacing: '0.02em',
      }}>
        {value}
      </p>
    </div>
  );
}