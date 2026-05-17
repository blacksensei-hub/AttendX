// client/src/pages/admin/Heatmap.jsx
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState, useCallback } from 'react';
import {
  MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap,
} from 'react-leaflet';
import { io } from 'socket.io-client';
import { Loader2, RefreshCw, Radio, Building2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { getHeatmapData } from '../../services/adminService';
import { useIsMobile } from '../../hooks/useIsMobile';

// Fix Leaflet broken icon paths with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CAMPUS_CENTRES = {
  tesano: { lat: 5.5961, lng: -0.2235, label: 'Tesano (Main)' },
  abeka:  { lat: 5.5995, lng: -0.2362, label: 'Abeka'         },
};

const CAMPUS_RADIUS_M = 220;

const CAMPUS_COLORS = {
  tesano: '#2563eb',
  abeka:  '#7c3aed',
};

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export default function AdminHeatmapPage() {
  const isMobile = useIsMobile();
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view,       setView]       = useState('both');
  const [pulsing,    setPulsing]    = useState({});

  // ─── Data fetch via adminService (auth handled automatically) ─
  const loadData = useCallback(async (spinner = true) => {
    if (spinner) setLoading(true); else setRefreshing(true);
    try {
      const result = await getHeatmapData();
      setData(result);
    } catch (err) {
      toast.error('Failed to load heatmap data');
      console.error('[Heatmap]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Socket.io pulse on attendance scan ───────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socket.on('attendance:marked', ({ classId }) => {
      if (!classId) return;
      setPulsing(prev => ({ ...prev, [classId]: true }));
      setTimeout(() => setPulsing(prev => {
        const next = { ...prev };
        delete next[classId];
        return next;
      }), 1600);

      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          classrooms: prev.classrooms.map(c =>
            c.id !== classId || !c.activeSession ? c : {
              ...c,
              activeSession: { ...c.activeSession, attendees: c.activeSession.attendees + 1 },
            }
          ),
          totals: { ...prev.totals, liveAttendees: prev.totals.liveAttendees + 1 },
        };
      });
    });

    return () => socket.disconnect();
  }, []);

  const classrooms     = data?.classrooms?.filter(c => view === 'both' || c.campus === view) || [];
  const activeSessions = classrooms.filter(c => c.activeSession);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
        <Loader2 size={26} className="hmSpin" />
        Loading campus map…
        <style>{spinCSS}</style>
      </div>
    );
  }

  const initialCentre =
    view === 'tesano' ? [CAMPUS_CENTRES.tesano.lat, CAMPUS_CENTRES.tesano.lng] :
    view === 'abeka'  ? [CAMPUS_CENTRES.abeka.lat,  CAMPUS_CENTRES.abeka.lng]  :
    [(CAMPUS_CENTRES.tesano.lat + CAMPUS_CENTRES.abeka.lat) / 2,
     (CAMPUS_CENTRES.tesano.lng + CAMPUS_CENTRES.abeka.lng) / 2];

  const initialZoom = view === 'both' ? 15 : 17;

  return (
    <div style={{
      fontFamily:    'var(--font-display)',
      display:       'flex',
      flexDirection: 'column',
      gap:           isMobile ? 12 : 16,
      // On mobile the page scrolls naturally; on desktop fill the viewport
      height:        isMobile ? 'auto' : 'calc(100vh - 80px)',
      padding:       isMobile ? '0' : '0',
    }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        flexWrap:       'wrap',
        gap:            10,
        flexShrink:     0,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 'var(--text-xl)' : 'clamp(20px,2.5vw,28px)', fontWeight: 700, color: 'var(--text-primary)' }}>
            Live campus heatmap
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {data?.totals?.activeSessions || 0} active sessions
            {' · '}{data?.totals?.liveAttendees || 0} live attendees
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Campus toggle */}
          <div style={{ display: 'flex', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {['both', 'tesano', 'abeka'].map(v => (
              <button key={v} type="button" onClick={() => setView(v)}
                style={{
                  padding: isMobile ? '7px 10px' : '8px 14px',
                  background: view === v ? 'var(--brand)' : 'var(--bg-card)',
                  color: view === v ? '#ffffff' : 'var(--text-primary)',
                  border: 'none', fontSize: isMobile ? 12 : 13,
                  fontWeight: view === v ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {v === 'both' ? (isMobile ? 'Both' : 'Both campuses') :
                 v === 'tesano' ? 'Tesano' : 'Abeka'}
              </button>
            ))}
          </div>

          <button type="button" onClick={() => loadData(false)} disabled={refreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {refreshing ? <Loader2 size={15} className="hmSpin" /> : <RefreshCw size={15} />}
            {!isMobile && 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Campus summary cards (mobile only) ──────────────── */}
      {isMobile && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {data?.campusSummary
            ?.filter(c => view === 'both' || c.key === view)
            .map(campus => (
              <div key={campus.key} style={{
                background:   view === 'both' || view === campus.key
                  ? campus.key === 'tesano'
                    ? 'rgba(37,99,235,0.08)'
                    : 'rgba(124,58,237,0.08)'
                  : 'var(--bg-card)',
                border:       `1px solid ${CAMPUS_COLORS[campus.key]}30`,
                borderRadius: 'var(--radius-atomic)',
                padding:      '12px',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: CAMPUS_COLORS[campus.key], marginBottom: 8 }}>
                  {campus.label}
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{campus.totalClasses}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>classrooms</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: campus.activeSessions > 0 ? '#10b981' : 'var(--text-muted)' }}>
                      {campus.activeSessions}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>active now</div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ── Main layout: map + sidebar ───────────────────────── */}
      <div style={{
        display:       'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap:           16,
        flex:          isMobile ? 'none' : 1,
        minHeight:     0,
      }}>

        {/* ── Map ─────────────────────────────────────────────── */}
        <div style={{
          flex:         isMobile ? 'none' : 1,
          height:       isMobile ? '340px' : '100%',
          borderRadius: 'var(--radius-lg,16px)',
          overflow:     'hidden',
          border:       '1px solid var(--border)',
          position:     'relative',
          minHeight:    0,
        }}>
          <MapContainer
            key={view}
            center={initialCentre}
            zoom={initialZoom}
            style={{ height: '100%', width: '100%', borderRadius: 'inherit' }}
            zoomControl={!isMobile}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {(view === 'both' ? ['tesano', 'abeka'] : [view]).map(campus => (
              <Circle
                key={campus}
                center={[CAMPUS_CENTRES[campus].lat, CAMPUS_CENTRES[campus].lng]}
                radius={CAMPUS_RADIUS_M}
                pathOptions={{
                  color: CAMPUS_COLORS[campus], weight: 2,
                  dashArray: '8 6',
                  fillColor: CAMPUS_COLORS[campus], fillOpacity: 0.04,
                }}
              />
            ))}

            {classrooms.map(cls => (
              <ClassroomMarker
                key={cls.id}
                classroom={cls}
                isActive={Boolean(cls.activeSession)}
                isPulsing={Boolean(pulsing[cls.id])}
                colour={cls.activeSession ? '#10b981' : CAMPUS_COLORS[cls.campus] || '#94a3b8'}
              />
            ))}

            <MapFlyController view={view} />
          </MapContainer>

          {/* Legend */}
          <div style={{
            position: 'absolute', bottom: 10, left: 10, zIndex: 1000,
            background: 'rgba(17,17,32,0.88)', backdropFilter: 'blur(8px)',
            borderRadius: 10, padding: '8px 10px',
            display: 'flex', flexDirection: 'column', gap: 5,
            boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)',
          }}>
            <LegendItem colour="#10b981" label="Active session" />
            <LegendItem colour="#2563eb" label="Tesano" />
            <LegendItem colour="#7c3aed" label="Abeka" />
            <LegendItem colour="#10b981" label="Pulse = scan" ring />
          </div>
        </div>

        {/* ── Sidebar ─────────────────────────────────────────── */}
        <div style={{
          width:         isMobile ? '100%' : 280,
          flexShrink:    0,
          overflowY:     isMobile ? 'visible' : 'auto',
          display:       'flex',
          flexDirection: 'column',
          gap:           10,
        }}>
          {/* Campus summary cards — desktop only */}
          {!isMobile && data?.campusSummary
            ?.filter(c => view === 'both' || c.key === view)
            .map(campus => (
              <div key={campus.key} style={{
                background: campus.key === 'tesano' ? 'rgba(37,99,235,0.06)' : 'rgba(124,58,237,0.06)',
                border:     `1px solid ${CAMPUS_COLORS[campus.key]}30`,
                borderRadius: 'var(--radius-atomic)', padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Building2 size={15} color={CAMPUS_COLORS[campus.key]} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{campus.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 24 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{campus.totalClasses}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>classrooms</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: campus.activeSessions > 0 ? '#10b981' : 'var(--text-muted)' }}>{campus.activeSessions}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>active now</div>
                  </div>
                </div>
              </div>
            ))}

          {/* Live sessions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <Radio size={13} color="#10b981" />
            <span>Live sessions</span>
            {activeSessions.length > 0 && (
              <span style={{ background: 'rgba(16,185,129,0.12)', color: '#059669', padding: '2px 8px', borderRadius: 99, fontWeight: 700, fontSize: 10, textTransform: 'none', letterSpacing: 0 }}>
                {activeSessions.length} live
              </span>
            )}
          </div>

          {activeSessions.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0' }}>No sessions open right now.</p>
          ) : (
            activeSessions.map(cls => (
              <ActiveSessionCard key={cls.id} classroom={cls} isPulsing={Boolean(pulsing[cls.id])} />
            ))
          )}

          {/* All classrooms list */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <Building2 size={13} />
            <span>All classrooms</span>
          </div>

          {/* On mobile: 2-column grid; desktop: list */}
          <div style={{
            display:             isMobile ? 'grid' : 'flex',
            gridTemplateColumns: isMobile ? '1fr 1fr' : undefined,
            flexDirection:       isMobile ? undefined : 'column',
            gap:                 8,
          }}>
            {classrooms.map(cls => (
              <div key={cls.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: isMobile ? '10px' : '8px 0',
                borderBottom: isMobile ? 'none' : '1px solid var(--border)',
                background: isMobile ? 'var(--bg-card)' : 'transparent',
                borderRadius: isMobile ? 'var(--radius-atomic)' : 0,
                border: isMobile ? '1px solid var(--border)' : undefined,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: cls.activeSession ? '#10b981' : 'var(--text-disabled)',
                  boxShadow: cls.activeSession ? '0 0 6px 2px rgba(16,185,129,0.4)' : 'none',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cls.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {cls.code}
                  </div>
                </div>
                {cls.activeSession && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: '#059669', background: '#dcfce7', padding: '2px 6px', borderRadius: 99, flexShrink: 0 }}>
                    <Users size={9} />
                    {cls.activeSession.attendees}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        ${spinCSS}
        .hmActiveClassroom { animation: hmGlowAnim 2s ease-in-out infinite; }
        @keyframes hmGlowAnim {
          0%, 100% { filter: drop-shadow(0 0 3px #10b981); }
          50%       { filter: drop-shadow(0 0 10px #10b981); }
        }
        .hmPulseRing { animation: hmPulse 1.5s ease-out forwards; }
        @keyframes hmPulse { 0% { stroke-opacity: 0.9; } 100% { stroke-opacity: 0; } }
      `}</style>
    </div>
  );
}

// ─── Classroom marker ────────────────────────────────────────
function ClassroomMarker({ classroom, isActive, isPulsing, colour }) {
  return (
    <>
      <CircleMarker
        center={[classroom.lat, classroom.lng]}
        radius={isActive ? 12 : 8}
        pathOptions={{
          color: colour, weight: isActive ? 3 : 1.5,
          fillColor: colour, fillOpacity: isActive ? 0.85 : 0.45,
          className: isActive ? 'hmActiveClassroom' : '',
        }}
      >
        <Popup maxWidth={240}>
          <div style={{ fontFamily: 'var(--font-display,"Segoe UI",sans-serif)', minWidth: 180 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{classroom.name}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
              {classroom.code} · {CAMPUS_CENTRES[classroom.campus]?.label}
            </div>
            {classroom.lecturer && (
              <div style={{ fontSize: 12, marginBottom: 8 }}>👤 {classroom.lecturer.name}</div>
            )}
            {classroom.activeSession ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontWeight: 600, color: '#059669', fontSize: 12 }}>● Session open</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>👥 {classroom.activeSession.attendees} present</div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>No active session</div>
            )}
          </div>
        </Popup>
      </CircleMarker>

      {isPulsing && (
        <CircleMarker
          center={[classroom.lat, classroom.lng]}
          radius={8}
          pathOptions={{ color: colour, weight: 2, fillOpacity: 0, opacity: 0.8, className: 'hmPulseRing' }}
        />
      )}
    </>
  );
}

// ─── Map fly controller ──────────────────────────────────────
function MapFlyController({ view }) {
  const map = useMap();
  useEffect(() => {
    const target =
      view === 'tesano' ? [CAMPUS_CENTRES.tesano.lat, CAMPUS_CENTRES.tesano.lng] :
      view === 'abeka'  ? [CAMPUS_CENTRES.abeka.lat,  CAMPUS_CENTRES.abeka.lng]  :
      [(CAMPUS_CENTRES.tesano.lat + CAMPUS_CENTRES.abeka.lat) / 2,
       (CAMPUS_CENTRES.tesano.lng + CAMPUS_CENTRES.abeka.lng) / 2];
    map.flyTo(target, view === 'both' ? 15 : 17, { duration: 1.2 });
  }, [view, map]);
  return null;
}

// ─── Active session card ─────────────────────────────────────
function ActiveSessionCard({ classroom, isPulsing }) {
  const elapsed = classroom.activeSession?.openedAt
    ? Math.floor((Date.now() - new Date(classroom.activeSession.openedAt)) / 60000)
    : 0;
  return (
    <div style={{
      background: '#f0fdf4', border: `1px solid ${isPulsing ? '#10b981' : '#bbf7d0'}`,
      borderRadius: 'var(--radius-atomic)', padding: '10px 12px',
      boxShadow: isPulsing ? '0 0 0 3px rgba(16,185,129,0.2)' : 'none',
      transition: 'box-shadow 0.3s, border-color 0.3s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{classroom.name}</div>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#dcfce7', padding: '2px 7px', borderRadius: 99, letterSpacing: '0.05em', flexShrink: 0, marginLeft: 6 }}>● LIVE</span>
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{classroom.code}</div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: '#374151' }}>
        <span>👥 {classroom.activeSession.attendees} present</span>
        <span>⏱ {elapsed}m open</span>
      </div>
      {isPulsing && (
        <div style={{ marginTop: 6, padding: '3px 8px', background: '#ecfdf5', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#059669' }}>
          ⚡ Scan detected
        </div>
      )}
    </div>
  );
}

// ─── Legend item ─────────────────────────────────────────────
function LegendItem({ colour, label, ring }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: ring ? 'transparent' : colour, border: ring ? `2px solid ${colour}` : 'none', flexShrink: 0 }} />
      {label}
    </div>
  );
}

const spinCSS = `.hmSpin{animation:hmSpinA 0.9s linear infinite}@keyframes hmSpinA{to{transform:rotate(360deg)}}`;