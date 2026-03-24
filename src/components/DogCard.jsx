import { useState, useRef, useCallback } from 'react'

function nameToColor(name) {
  const colors = ['#7F77DD','#378ADD','#BA7517','#1D9E75','#D85A30','#5DCAA5','#534AB7','#993C1D'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function extractStreet(address) {
  if (!address) return null;
  // Take the first line / first comma-segment, strip leading number
  const seg = address.split(',')[0].trim();
  const parts = seg.split(/\s+/);
  // Drop leading house number if it starts with digits
  if (parts.length > 1 && /^\d/.test(parts[0])) parts.shift();
  return parts.join(' ');
}

export default function DogCard({
  dog,
  routeNumber = null,
  owlNote = null,
  altAddress = null,
  isLocked = false,
  isPickedUp = false,
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
  const touchRef = useRef({ startX: 0, startY: 0, locked: false });

  const THRESHOLD = 60;

  const handleTouchStart = useCallback((e) => {
    if (!isLocked || isPickedUp) return;
    const t = e.touches[0];
    touchRef.current = { startX: t.clientX, startY: t.clientY, locked: false };
    setSwiping(false);
    setSwipeX(0);
  }, [isLocked, isPickedUp]);

  const handleTouchMove = useCallback((e) => {
    if (!isLocked || isPickedUp) return;
    const t = e.touches[0];
    const dx = t.clientX - touchRef.current.startX;
    const dy = t.clientY - touchRef.current.startY;

    // If we haven't committed to a direction yet, check angle
    if (!touchRef.current.locked) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) return; // vertical scroll
      if (Math.abs(dx) > 10) touchRef.current.locked = true;
      else return;
    }

    e.preventDefault();
    setSwiping(true);
    setSwipeX(dx);
  }, [isLocked, isPickedUp]);

  const handleTouchEnd = useCallback(() => {
    if (!swiping) return;
    if (swipeX < -THRESHOLD && onSwipeLeft) {
      onSwipeLeft();
    } else if (swipeX > THRESHOLD && onSwipeRight) {
      onSwipeRight();
    }
    setSwiping(false);
    setSwipeX(0);
  }, [swiping, swipeX, onSwipeLeft, onSwipeRight]);

  const photoUrl = dog.photo_url || null;
  const initial = dog.dog_name ? dog.dog_name.charAt(0).toUpperCase() : '?';
  const bgColor = nameToColor(dog.dog_name || '');
  const levelDot = (dog.level != null && dog.level >= 3) ? '#BA7517' : '#1D9E75';
  const streetName = extractStreet(dog.address);

  // Picked-up state styles
  const containerBg = isPickedUp ? '#f0fdf4' : '#ffffff';
  const containerBorder = isPickedUp ? '0.5px solid #bbf7d0' : '0.5px solid #e8e5e0';

  return (
    <div style={{ position: 'relative', marginBottom: 3 }}>
      {/* Swipe backdrops */}
      {swiping && swipeX < 0 && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 10,
          background: '#22c55e', display: 'flex', alignItems: 'center',
          justifyContent: 'flex-end', paddingRight: 14,
          color: '#fff', fontSize: 11, fontWeight: 600,
        }}>
          Done
        </div>
      )}
      {swiping && swipeX > 0 && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 10,
          background: '#E8634A', display: 'flex', alignItems: 'center',
          paddingLeft: 14,
          color: '#fff', fontSize: 11, fontWeight: 600,
        }}>
          Note
        </div>
      )}

      {/* Card */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'relative',
          background: containerBg,
          border: containerBorder,
          borderBottom: isPickedUp ? containerBorder : '2px solid #d5d2cc',
          borderRadius: 10,
          padding: '5px 7px',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          transform: swiping ? `translateX(${swipeX}px)` : 'translateX(0)',
          transition: swiping ? 'none' : 'transform 0.2s ease-out',
          touchAction: 'pan-y',
        }}
      >
        {/* Drag handle */}
        {showDragHandle && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 12, flexShrink: 0, alignItems: 'center', cursor: 'grab' }}>
            <div style={{ width: 10, height: 1.5, background: '#ccc', borderRadius: 1 }} />
            <div style={{ width: 10, height: 1.5, background: '#ccc', borderRadius: 1 }} />
            <div style={{ width: 10, height: 1.5, background: '#ccc', borderRadius: 1 }} />
          </div>
        )}

        {/* Route number */}
        {routeNumber != null && (
          <div style={{ width: 12, fontSize: 10, color: isPickedUp ? '#22c55e' : '#aaa', textAlign: 'center', flexShrink: 0, fontWeight: 600 }}>
            {isPickedUp ? '\u2713' : routeNumber}
          </div>
        )}

        {/* Dog photo / initial */}
        <div style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
          background: photoUrl ? '#f5f5f5' : bgColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {photoUrl ? (
            <img src={photoUrl} alt={dog.dog_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>{initial}</span>
          )}
        </div>

        {/* Level dot */}
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: levelDot, flexShrink: 0 }} />

        {/* Dog name */}
        <div
          onClick={onTapName || undefined}
          style={{
            fontSize: 11,
            fontWeight: 500,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            cursor: onTapName ? 'pointer' : 'default',
            textDecoration: isPickedUp ? 'line-through' : 'none',
            color: isPickedUp ? '#aaa' : '#1a1a1a',
          }}
        >
          {dog.dog_name}
        </div>

        {/* Pickup time (when picked up) */}
        {isPickedUp && pickupTime && (
          <span style={{ fontSize: 9, fontWeight: 600, color: '#0F6E56', flexShrink: 0 }}>
            {pickupTime}
          </span>
        )}

        {/* Address */}
        {!isPickedUp && streetName && (
          <div
            onClick={onTapAddress || undefined}
            style={{
              fontSize: 9, color: '#185FA5', fontWeight: 500, flexShrink: 0,
              cursor: onTapAddress ? 'pointer' : 'default',
              maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {streetName} ›
          </div>
        )}

        {/* Door code badge */}
        {!isPickedUp && dog.door_code && (
          <span style={{
            fontSize: 9, background: '#E6F1FB', color: '#185FA5', fontWeight: 600,
            padding: '2px 5px', borderRadius: 4, flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            #{dog.door_code}
          </span>
        )}

        {/* Owl dot */}
        {!isPickedUp && owlNote && (
          <div
            onClick={(e) => { e.stopPropagation(); setOwlExpanded(v => !v); }}
            style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              background: '#FAEEDA', border: '0.5px solid #FAC775',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 8, lineHeight: 1,
            }}
          >
            🦉
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
          <span style={{ marginRight: 4 }}>🦉</span>
          {owlNote.note_text}
          {owlNote.created_by_name && (
            <span style={{ color: '#a08050', marginLeft: 6 }}>
              — {owlNote.created_by_name}
              {owlNote.created_at && (' \u00b7 ' + new Date(owlNote.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
