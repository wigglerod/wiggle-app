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
  showDragHandle = false,
}) {
  const [owlExpanded, setOwlExpanded] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const cardRef = useRef(null);
  const touchRef = useRef({ x: 0, y: 0, claimed: false });

  const THRESHOLD = 60;

  // Use useEffect to attach touchmove with { passive: false } so preventDefault works on iOS
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

    // If vertical scroll wins, bail out
    if (!touchRef.current.claimed) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) return;
      if (Math.abs(dx) > 10) {
        touchRef.current.claimed = true;
      } else {
        return;
      }
    }

    e.preventDefault(); // claim the gesture, prevent scroll
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

  const photoUrl = dog.photo_url || null;
  const initial = dog.dog_name ? dog.dog_name.charAt(0).toUpperCase() : '?';
  const bgColor = nameToColor(dog.dog_name || '');
  const levelDot = (dog.level != null && dog.level >= 3) ? '#BA7517' : '#1D9E75';
  const streetName = dog.address || null;

  const containerBg = isPickedUp ? '#f0fdf4' : isCurrent ? '#FFF4F1' : '#ffffff';
  const containerBorder = isPickedUp ? '0.5px solid #bbf7d0' : isCurrent ? '1.5px solid #E8634A' : '0.5px solid #e8e5e0';

  // ── COMPACT MODE (for interlock zones) ──────────────────────
  if (isCompact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '6px 8px', borderRadius: 8,
        background: containerBg, border: containerBorder,
        borderBottom: isPickedUp ? containerBorder : '2px solid #d5d2cc',
        marginBottom: 3, fontSize: 11,
      }}>
        {routeNumber != null && (
          <span style={{ fontSize: 9, color: isPickedUp ? '#0F6E56' : isCurrent ? '#E8634A' : '#aaa', width: 12, textAlign: 'center', fontWeight: 600 }}>
            {isPickedUp ? '\u2713' : routeNumber}
          </span>
        )}
        <div style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
          background: photoUrl ? '#f5f5f5' : bgColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {photoUrl ? (
            <img src={photoUrl} alt={dog.dog_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ color: '#fff', fontSize: 8, fontWeight: 700 }}>{initial}</span>
          )}
        </div>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: levelDot, flexShrink: 0 }} />
        <span style={{
          flex: 1, fontWeight: 500, fontSize: 11, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textDecoration: isPickedUp ? 'line-through' : 'none',
          color: isPickedUp ? '#aaa' : '#1a1a1a',
        }}>
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

  // ── NORMAL MODE ─────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', marginBottom: 4 }}>
      {/* Swipe backdrops */}
      {swiping && swipeX < 0 && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 12,
          background: '#22c55e', display: 'flex', alignItems: 'center',
          justifyContent: 'flex-end', paddingRight: 14,
          color: '#fff', fontSize: 13, fontWeight: 600,
        }}>
          {'\u2713'} Done
        </div>
      )}
      {swiping && swipeX > 0 && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 12,
          background: '#E8634A', display: 'flex', alignItems: 'center',
          paddingLeft: 14,
          color: '#fff', fontSize: 13, fontWeight: 600,
        }}>
          Note {'\u270E'}
        </div>
      )}

      {/* Card */}
      <div
        ref={cardRef}
        style={{
          position: 'relative',
          background: containerBg,
          border: containerBorder,
          borderBottom: isPickedUp ? containerBorder : '2.5px solid #d5d2cc',
          borderRadius: 12,
          padding: '10px 12px 10px 16px',
          minHeight: 48,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transform: swiping ? `translateX(${swipeX}px)` : 'translateX(0)',
          transition: swiping ? 'none' : 'transform 0.2s ease-out',
          touchAction: 'pan-y',
        }}
      >
        {/* Left accent bar */}
        <div style={{
          position: 'absolute', left: 0, top: 4, bottom: 4,
          width: 3, borderRadius: 2,
          background: isPickedUp ? '#0F6E56' : isCurrent ? '#E8634A' : '#e0dcd8',
        }} />

        {/* Drag handle */}
        {showDragHandle && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2.5, width: 16, flexShrink: 0, alignItems: 'center', cursor: 'grab' }}>
            <div style={{ width: 14, height: 2, background: '#ccc', borderRadius: 1 }} />
            <div style={{ width: 14, height: 2, background: '#ccc', borderRadius: 1 }} />
            <div style={{ width: 14, height: 2, background: '#ccc', borderRadius: 1 }} />
          </div>
        )}

        {/* Route number */}
        {routeNumber != null && (
          <div style={{ width: 16, fontSize: isPickedUp ? 14 : 12, color: isPickedUp ? '#0F6E56' : isCurrent ? '#E8634A' : '#aaa', textAlign: 'center', flexShrink: 0, fontWeight: isPickedUp ? 700 : 600 }}>
            {isPickedUp ? '\u2713' : routeNumber}
          </div>
        )}

        {/* Dog photo / initial */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
          background: photoUrl ? '#f5f5f5' : bgColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {photoUrl ? (
            <img src={photoUrl} alt={dog.dog_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{initial}</span>
          )}
        </div>

        {/* Level dot */}
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: levelDot, flexShrink: 0 }} />

        {/* Dog name */}
        <div
          onClick={onTapName || undefined}
          style={{
            fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, letterSpacing: '-0.01em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            cursor: onTapName ? 'pointer' : 'default',
            textDecoration: isPickedUp ? 'line-through' : 'none',
            color: isPickedUp ? '#aaa' : '#1a1a1a',
          }}
        >
          {dog.dog_name}
        </div>

        {/* Pickup time */}
        {isPickedUp && pickupTime && (
          <span style={{ fontSize: 11, fontWeight: 600, color: '#0F6E56', flexShrink: 0 }}>{pickupTime}</span>
        )}

        {/* Address */}
        {!isPickedUp && streetName && (
          <div
            onClick={onTapAddress || undefined}
            style={{
              fontSize: 11, color: '#185FA5', fontWeight: 500, flexShrink: 0,
              cursor: onTapAddress ? 'pointer' : 'default',
              textDecoration: 'none', borderBottom: '1px dotted #185FA5', paddingBottom: 1,
            }}
          >
            {streetName} {'\u203A'}
          </div>
        )}

        {/* Door code badge */}
        {dog.door_code && (
          <span style={{
            fontSize: 11, background: '#E6F1FB', color: '#185FA5', fontWeight: 600,
            padding: '3px 8px', borderRadius: 6, flexShrink: 0, whiteSpace: 'nowrap',
            boxShadow: '0 1px 2px rgba(24,95,165,0.15)',
          }}>
            #{dog.door_code}
          </span>
        )}

        {/* Owl dot */}
        {!isPickedUp && owlNote && (
          <div
            onClick={(e) => { e.stopPropagation(); setOwlExpanded(v => !v); }}
            style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              background: '#FAEEDA', border: '0.5px solid #FAC775',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 10, lineHeight: 1,
            }}
          >
            {'\u{1F989}'}
          </div>
        )}

        {/* Alt address badge */}
        {!isPickedUp && altAddress && (
          <span style={{
            fontSize: 8, background: '#FAEEDA', color: '#854F0B',
            padding: '1px 4px', borderRadius: 3, flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            2nd home
          </span>
        )}
      </div>

      {/* Owl note expansion */}
      {owlExpanded && owlNote && (
        <div style={{
          background: '#FAEEDA', border: '0.5px solid #FAC775',
          borderRadius: '0 0 8px 8px', padding: '6px 8px', marginTop: -3,
          fontSize: 10, color: '#854F0B', lineHeight: 1.4,
        }}>
          <span style={{ marginRight: 4 }}>{'\u{1F989}'}</span>
          {owlNote.note_text}
          {owlNote.created_by_name && (
            <span style={{ color: '#a08050', marginLeft: 6 }}>
              {'\u2014'} {owlNote.created_by_name}
              {owlNote.created_at && (' \u00b7 ' + new Date(owlNote.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
