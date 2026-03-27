import { useState, useRef, useEffect, useCallback } from 'react'

function nameToColor(name) {
  const colors = ['#7F77DD','#378ADD','#BA7517','#1D9E75','#D85A30','#5DCAA5','#534AB7','#993C1D'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}


export default function DogCard({
  dog,
  routeNumber = null,
  owlNote = null,
  altAddress = null,
  isLocked = false,
  isPickedUp = false,
  isCurrent = false,
  isCompact = false,
  pickupTime = null,
  onSwipeLeft,
  onSwipeRight,
  onTapName,
  onTapAddress,
  onUndoPickup,
  showDragHandle = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const cardRef = useRef(null);
  const touchRef = useRef({ x: 0, y: 0, claimed: false });

  const THRESHOLD = 60;

  const swipeXRef = useRef(0);
  const swipingRef = useRef(false);

  const handleTouchStart = useCallback((e) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, claimed: false };
    swipeXRef.current = 0;
    swipingRef.current = false;
    setSwipeX(0);
    setSwiping(false);
  }, []);

  const handleTouchMove = useCallback((e) => {
    const t = e.touches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;

    if (!touchRef.current.claimed) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) return;
      if (Math.abs(dx) > 10) {
        touchRef.current.claimed = true;
      } else {
        return;
      }
    }

    e.preventDefault();
    swipeXRef.current = dx;
    swipingRef.current = true;
    setSwipeX(dx);
    setSwiping(true);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!swipingRef.current) return;
    const dx = swipeXRef.current;
    if (dx < -THRESHOLD && onSwipeLeft) {
      try { navigator.vibrate?.(10) } catch {}
      onSwipeLeft();
    } else if (dx > THRESHOLD && onSwipeRight) {
      try { navigator.vibrate?.(10) } catch {}
      onSwipeRight();
    }
    swipingRef.current = false;
    swipeXRef.current = 0;
    setSwiping(false);
    setSwipeX(0);
  }, [onSwipeLeft, onSwipeRight]);

  // Attach listeners with passive:false for iOS Safari
  useEffect(() => {
    const el = cardRef.current;
    if (!el || !isLocked || isPickedUp) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isLocked, isPickedUp, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Auto-collapse when picked up; reset undo confirm when state changes
  useEffect(() => {
    if (isPickedUp) setExpanded(false);
    if (!isPickedUp) setShowUndoConfirm(false);
  }, [isPickedUp]);

  function cleanAddress(raw) {
    if (!raw) return '';
    // Strip everything after first comma (city, province, country)
    let addr = raw.split(',')[0].trim();
    // Strip Canadian postal codes (H2W 2L5 or H2W2L5 pattern)
    addr = addr.replace(/\s*[A-Z]\d[A-Z]\s*\d[A-Z]\d\s*$/i, '').trim();
    return addr;
  }

  const photoUrl = dog.photo_url || null;
  const initial = dog.dog_name ? dog.dog_name.charAt(0).toUpperCase() : '?';
  const bgColor = nameToColor(dog.dog_name || '');
  const levelDot = (dog.level != null && dog.level >= 3) ? '#BA7517' : '#1D9E75';
  const hasPermanentNotes = dog.notes && dog.notes.trim().length > 0;
  const nameColor = hasPermanentNotes ? '#961e78' : '#534AB7';

  const containerBg = isPickedUp ? '#f0fdf4' : isCurrent ? '#FFF4F1' : '#ffffff';
  const containerBorder = isPickedUp ? '1px solid #bbf7d0'
    : isCurrent ? '1.5px solid #E8634A'
    : '0.5px solid #e8e5e0';
  const containerBorderBottom = isPickedUp ? '2.5px solid #86efac'
    : isCurrent ? '2.5px solid #E8634A'
    : '2.5px solid #d5d2cc';

  // ── COMPACT MODE (for interlock zones) ──────────────────────
  if (isCompact) {
    return (
      <div
        onClick={() => onTapAddress?.()}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '6px 8px', borderRadius: 8,
          background: containerBg, border: containerBorder,
          borderBottom: isPickedUp ? containerBorder : '2px solid #d5d2cc',
          marginBottom: 3, fontSize: 11, cursor: 'pointer',
        }}
      >
        {routeNumber != null && (
          <span style={{ fontSize: 9, color: isPickedUp ? '#0F6E56' : isCurrent ? '#E8634A' : '#aaa', width: 12, textAlign: 'center', fontWeight: 600 }}>
            {isPickedUp ? '\u2713' : routeNumber}
          </span>
        )}
        <div style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
          background: photoUrl ? '#f5f5f5' : bgColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: isPickedUp ? 0.5 : 1,
        }}>
          {photoUrl ? (
            <img src={photoUrl} alt={dog.dog_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ color: '#fff', fontSize: 8, fontWeight: 700 }}>{initial}</span>
          )}
        </div>
        <span
          onClick={(e) => {
            if (onTapName) { e.stopPropagation(); onTapName(); }
          }}
          style={{
            fontWeight: 500, fontSize: 11, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            textDecoration: isPickedUp ? 'line-through' : 'none',
            color: isPickedUp ? '#aaa' : nameColor,
            borderBottom: isPickedUp ? 'none' : '1px dashed #AFA9EC',
            cursor: onTapName ? 'pointer' : 'default',
          }}
        >
          {dog.dog_name}
        </span>
        {dog.door_code && (
          <span style={{ fontSize: 8, color: '#185FA5', fontWeight: 600, background: '#E6F1FB', padding: '1px 4px', borderRadius: 3 }}>
            #{dog.door_code}
          </span>
        )}
        {isPickedUp && pickupTime && (
          <span style={{ fontSize: 9, fontWeight: 600, color: '#0F6E56', flexShrink: 0 }}>{pickupTime}</span>
        )}
      </div>
    );
  }

  // ── NORMAL MODE — Mini card + expandable panel ──────────────
  return (
    <div style={{ marginBottom: 3 }}>
      {/* Swipe backdrops */}
      {swiping && swipeX < 0 && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 12, zIndex: 0,
          background: '#22c55e', display: 'flex', alignItems: 'center',
          justifyContent: 'flex-end', paddingRight: 14,
          color: '#fff', fontSize: 13, fontWeight: 600,
        }}>
          {'\u2713'} Done
        </div>
      )}
      {swiping && swipeX > 0 && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 12, zIndex: 0,
          background: '#E8634A', display: 'flex', alignItems: 'center',
          paddingLeft: 14,
          color: '#fff', fontSize: 13, fontWeight: 600,
        }}>
          Note {'\u270E'}
        </div>
      )}

      {/* ── MINI CARD ───────────────────────────────────────── */}
      <div
        ref={cardRef}
        onClick={() => {
          if (isPickedUp && onUndoPickup) {
            setShowUndoConfirm(true);
          } else {
            setExpanded(prev => !prev);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          borderRadius: expanded ? '12px 12px 0 0' : 12,
          background: containerBg,
          border: containerBorder,
          borderBottom: expanded ? containerBorder : containerBorderBottom,
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          position: 'relative',
          minHeight: 48,
          transition: 'all 0.15s',
          transform: swiping ? `translateX(${swipeX}px)` : 'translateX(0)',
          touchAction: 'pan-y',
        }}
      >
        {/* Drag handle */}
        {showDragHandle && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2,
            width: 14, flexShrink: 0, alignItems: 'center', cursor: 'grab' }}>
            <span style={{ display: 'block', width: 12, height: 2, background: '#ccc', borderRadius: 1 }} />
            <span style={{ display: 'block', width: 12, height: 2, background: '#ccc', borderRadius: 1 }} />
            <span style={{ display: 'block', width: 12, height: 2, background: '#ccc', borderRadius: 1 }} />
          </div>
        )}

        {/* Route number */}
        {routeNumber != null && (
          <span style={{
            fontSize: 12, fontWeight: 600, width: 18, textAlign: 'center',
            color: isPickedUp ? '#0F6E56' : isCurrent ? '#E8634A' : '#aaa',
            flexShrink: 0,
          }}>
            {isPickedUp ? '\u2713' : routeNumber}
          </span>
        )}

        {/* Level dot */}
        <span style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: levelDot,
        }} />

        {/* Dog name */}
        <span
          onClick={(e) => {
            if (onTapName) { e.stopPropagation(); onTapName(); }
          }}
          style={{
            fontSize: 14, fontWeight: 600,
            color: isPickedUp ? '#aaa' : nameColor,
            textDecoration: isPickedUp ? 'line-through' : 'none',
            borderBottom: isPickedUp ? 'none' : '1px dashed #AFA9EC',
            letterSpacing: '-0.01em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flexShrink: 1, minWidth: 0,
            cursor: onTapName ? 'pointer' : 'default',
          }}
        >
          {dog.dog_name}
        </span>

        {/* Address — ALWAYS visible on mini card */}
        {!isPickedUp && dog.address && (
          <span style={{
            flex: 1, fontSize: 10, color: '#475569', fontWeight: 500,
            textAlign: 'right', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {cleanAddress(dog.address)}
          </span>
        )}

        {/* Right side — context-dependent */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Pickup time — ALWAYS visible when picked up */}
          {isPickedUp && pickupTime && (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0F6E56' }}>
              {pickupTime}
            </span>
          )}

          {/* Door code — show inline on mini card when NOT picked up */}
          {!isPickedUp && dog.door_code && (
            <span style={{
              fontSize: 9, color: '#fff', fontWeight: 700,
              background: '#475569', padding: '2px 7px', borderRadius: 5,
            }}>
              #{dog.door_code}
            </span>
          )}

          {/* Owl indicator — tiny yellow dot when collapsed */}
          {owlNote && !expanded && (
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#FAC775', flexShrink: 0,
            }} />
          )}

          {/* Expand chevron — only when NOT picked up */}
          {!isPickedUp && (
            <span style={{
              fontSize: 10, color: '#ccc',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 0.2s',
            }}>
              {'\u25BC'}
            </span>
          )}
        </div>

        {/* Undo pickup confirmation overlay */}
        {isPickedUp && showUndoConfirm && (
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.97)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            zIndex: 5,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid #e5e5e5',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>Undo pickup?</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={(e) => { e.stopPropagation(); onUndoPickup(); setShowUndoConfirm(false); }}
                style={{
                  padding: '8px 14px', borderRadius: 8,
                  background: '#E8634A', color: '#fff', border: 'none',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                Yes, undo
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowUndoConfirm(false); }}
                style={{
                  padding: '8px 14px', borderRadius: 8,
                  background: '#f0f0f0', color: '#888', border: 'none',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                Keep
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── EXPANDED PANEL ──────────────────────────────────── */}
      {expanded && (
        <div style={{
          padding: '10px 14px 12px',
          background: '#fafaf8',
          borderRadius: '0 0 12px 12px',
          border: '0.5px solid #e8e5e0',
          borderTop: 'none',
        }}>

          {/* Address row */}
          {dog.address && (
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 8,
            }}>
              <span
                onClick={(e) => { e.stopPropagation(); onTapAddress?.() }}
                style={{
                  fontSize: 13, color: '#185FA5', fontWeight: 500,
                  cursor: 'pointer', flex: 1,
                }}
              >
                {dog.address} {'\u203A'}
              </span>
            </div>
          )}

          {/* Owl note — full display */}
          {owlNote && (
            <div style={{
              padding: '8px 12px', background: '#FAEEDA',
              border: '0.5px solid #FAC775', borderRadius: 8,
              fontSize: 12, color: '#633806', marginBottom: 8,
              lineHeight: 1.5,
            }}>
              {'\u{1F989}'} {owlNote.note_text}
              {owlNote.created_by_name && (
                <span style={{ color: '#a08050', marginLeft: 6, fontSize: 10 }}>
                  {'\u2014'} {owlNote.created_by_name}
                </span>
              )}
            </div>
          )}

          {/* Alt address */}
          {altAddress && (
            <div style={{
              padding: '6px 10px', background: '#FAEEDA',
              borderRadius: 8, fontSize: 11, color: '#854F0B',
              marginBottom: 8,
            }}>
              {'\u{1F4CD}'} Different address today
            </div>
          )}

          {/* ACTION BUTTONS — the main event */}
          {isLocked && !isPickedUp && (
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {onSwipeLeft && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onSwipeLeft()
                    setExpanded(false)
                  }}
                  style={{
                    flex: 1, padding: '12px 14px', borderRadius: 10,
                    background: 'linear-gradient(180deg, #0F6E56 0%, #0a5740 100%)',
                    color: '#fff', border: 'none',
                    borderBottom: '3px solid #074030',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(15,110,86,0.3)',
                    textAlign: 'center',
                  }}
                >
                  {'\u2713'} Picked up
                </button>
              )}
              {onSwipeRight && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onSwipeRight()
                  }}
                  style={{
                    flex: 1, padding: '12px 14px', borderRadius: 10,
                    background: 'linear-gradient(180deg, #E8634A 0%, #d4552d 100%)',
                    color: '#fff', border: 'none',
                    borderBottom: '3px solid #b8461f',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(232,99,74,0.3)',
                    textAlign: 'center',
                  }}
                >
                  {'\u270E'} Add note
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
