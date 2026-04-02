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
  isReturned = false,
  isNotWalking = false,
  isCurrent = false,
  isCompact = false,
  interlockOwner = null, // 'A' or 'B'
  pickupTime = null,     // formatted string e.g. "9:32 AM"
  returnedTime = null,   // formatted string e.g. "10:48 AM"
  onSwipeLeft,           // State 1 → 2: pick up
  onSwipeLeftSecond,     // State 2 → 3: back home
  onSwipeRight,          // Note swipe (right)
  onTapName,
  onTapAddress,
  onUndoPickup,          // kept for compat but undo now lives in profile
  showDragHandle = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const cardRef = useRef(null);
  const touchRef = useRef({ x: 0, y: 0, claimed: false });

  // Swipe threshold = 30% of card width, min 60px
  const THRESHOLD_PX = 60;

  const swipeXRef = useRef(0);
  const swipingRef = useRef(false);

  // Keep latest swipe callbacks in a ref so handleTouchEnd is always stable
  // and never reads stale closure values after state transitions (e.g. pickup → return)
  const swipeCallbacksRef = useRef({ onSwipeLeft, onSwipeLeftSecond, onSwipeRight });
  swipeCallbacksRef.current = { onSwipeLeft, onSwipeLeftSecond, onSwipeRight };

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
    const { onSwipeLeft: left, onSwipeLeftSecond: leftSecond, onSwipeRight: right } = swipeCallbacksRef.current;

    if (dx < -THRESHOLD_PX) {
      try { navigator.vibrate?.(10) } catch {}
      if (left) left();
      else if (leftSecond) leftSecond();
    } else if (dx > THRESHOLD_PX && right) {
      try { navigator.vibrate?.(10) } catch {}
      right();
    }

    swipingRef.current = false;
    swipeXRef.current = 0;
    setSwiping(false);
    setSwipeX(0);
  }, []);

  // Attach touch listeners — active when locked and not yet returned
  useEffect(() => {
    const el = cardRef.current;
    if (!el || !isLocked || isReturned || isNotWalking) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isLocked, isReturned, isNotWalking, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Collapse expanded panel when state changes
  useEffect(() => {
    if (isPickedUp || isReturned) setExpanded(false);
  }, [isPickedUp, isReturned]);

  const photoUrl = dog.photo_url || null;
  const initial = dog.dog_name ? dog.dog_name.charAt(0).toUpperCase() : '?';
  const bgColor = nameToColor(dog.dog_name || '');
  const levelDot = dog.level === 3 ? '#EF4444' : dog.level === 2 ? '#FBBF24' : '#1D9E75';

  // ── Derive visual state ────────────────────────────────────────
  // State 3: Returned home
  // State 2: Picked up (not yet returned)
  // State 1: Waiting

  // ── Container styles per state ─────────────────────────────────
  let containerBg, containerBorder, containerBorderBottom, containerOpacity;

  if (isReturned) {
    containerBg = '#F0ECE8';
    containerBorder = '1px solid #E8E4E0';
    containerBorderBottom = '1px solid #E8E4E0';
    containerOpacity = 0.55;
  } else if (isPickedUp) {
    containerBg = '#E8F5EF';
    containerBorder = '1px solid #6DCAA8';
    containerBorderBottom = '1px solid #6DCAA8';
    containerOpacity = 1;
  } else if (isNotWalking) {
    containerBg = '#FDF3E3';
    containerBorder = '1px solid #F0C76E';
    containerBorderBottom = '1px solid #F0C76E';
    containerOpacity = 1;
  } else if (isCurrent) {
    containerBg = '#FFF4F1';
    containerBorder = '1.5px solid #E8634A';
    containerBorderBottom = '2.5px solid #E8634A';
    containerOpacity = 1;
  } else {
    containerBg = '#FAF7F4';
    containerBorder = '1px solid #E8E4E0';
    containerBorderBottom = '2.5px solid #D5CFC8';
    containerOpacity = 1;
  }

  // ── Swipe backdrop color logic ─────────────────────────────────
  // Left swipe reveal: sage (State 1) or coral (State 2)
  const leftRevealBg = isPickedUp ? '#E8634A' : '#E8F5EF';
  const leftRevealText = isPickedUp ? '#fff' : '#2D8F6F';
  const leftRevealContent = isPickedUp ? '🏠 Back home' : '✓ Pick up';

  // ── COMPACT MODE ──────────────────────────────────────────────
  if (isCompact) {
    let overrideBg = containerBg;
    let overrideBorder = containerBorder;
    let overrideBorderLeft = containerBorder;
    let nameColor = isNotWalking ? '#C4851C' : '#534AB7';
    const hasNotes = !!dog.notes;
    let marginLeft = '0';
    let marginRight = '0';
    let width = '100%';

    if (interlockOwner === 'A') {
      overrideBg = '#EEEDFE'; // purple-bg
      overrideBorder = '1px solid transparent';
      overrideBorderLeft = '3px solid #AFA9EC';
      nameColor = hasNotes ? '#961e78' : '#534AB7';
      width = '72%';
      marginRight = 'auto'; // hug left
    } else if (interlockOwner === 'B') {
      overrideBg = '#FAECE7'; // coral-light
      overrideBorder = '1px solid transparent';
      overrideBorderLeft = '3px solid #E8634A';
      nameColor = hasNotes ? '#961e78' : '#C94A34'; // coral-dark
      width = '72%';
      marginLeft = 'auto'; // hug right
    } else {
      if (hasNotes) nameColor = '#961e78';
    }

    return (
      <div style={{ marginBottom: 5, position: 'relative', width, marginLeft, marginRight }}>
        {/* Swipe backdrop */}
        {swiping && swipeX < 0 && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 8, zIndex: 0,
            background: leftRevealBg, display: 'flex', alignItems: 'center',
            justifyContent: 'flex-end', paddingRight: 10,
            color: leftRevealText, fontSize: 11, fontWeight: 700,
          }}>
            {leftRevealContent}
          </div>
        )}
        <div
          ref={cardRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => onTapAddress?.()}
          style={{
            transform: `translate3d(${swipeX}px, 0, 0)`,
            transition: swiping ? 'none' : 'transform 0.2s',
            display: 'flex', flexDirection: 'column', gap: 4,
            padding: '6px 8px', borderRadius: 10,
            background: overrideBg, border: overrideBorder,
            borderLeft: overrideBorderLeft,
            fontSize: 11, cursor: 'pointer',
            opacity: containerOpacity,
            position: 'relative', zIndex: 1,
            overflow: 'hidden',
          }}
        >
          {/* Row 1: Route, Photo, Name, Difficulty Dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
            {routeNumber != null && (
              <span style={{ fontSize: 9, color: isReturned ? '#B5AFA8' : isPickedUp ? '#2D8F6F' : isNotWalking ? '#C4851C' : isCurrent ? '#E8634A' : '#aaa', width: 14, textAlign: 'center', fontWeight: 700 }}>
                {isReturned ? '🏠' : isPickedUp ? '✓' : routeNumber}
              </span>
            )}
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
              background: photoUrl ? '#f5f5f5' : bgColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: (isPickedUp || isReturned) ? 0.5 : 1,
            }}>
              {photoUrl ? (
                <img src={photoUrl} alt={dog.dog_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ color: '#fff', fontSize: 8, fontWeight: 700 }}>{initial}</span>
              )}
            </div>
            <span
              onClick={(e) => { if (onTapName) { e.stopPropagation(); onTapName(); } }}
              style={{
                fontWeight: 600, fontSize: 11, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                textDecoration: (isPickedUp || isReturned || isNotWalking) ? 'line-through' : 'none',
                textDecorationColor: nameColor,
                color: nameColor,
                borderBottom: isNotWalking ? '1px dashed #F0C76E' : (hasNotes && !isPickedUp && !isReturned ? '1px dashed #961e78' : '1px dashed #AFA9EC'),
                cursor: onTapName ? 'pointer' : 'default',
              }}
            >
              {dog.dog_name}
            </span>
            {dog.level && (
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: dog.level === 3 ? '#E8634A' : dog.level === 2 ? '#C4851C' : '#2D8F6F'
              }} />
            )}
          </div>
          
          {/* Row 2: Address, Door code, Times */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', justifyContent: 'space-between', paddingLeft: Object.keys(dog).length > 0 ? 18 : 0 }}>
            {!isNotWalking && dog.address && (
              <span style={{
                flex: 1, fontSize: 10,
                color: (isPickedUp || isReturned) ? '#B5AFA8' : '#475569',
                fontWeight: 500,
                textAlign: 'left', whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {dog.address.split(',')[0]}
              </span>
            )}
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {isNotWalking && (
                <span style={{ fontSize: 8, color: '#C4851C', fontWeight: 700, background: '#FDF3E3', border: '1px solid #F0C76E', padding: '1px 4px', borderRadius: 3, flexShrink: 0 }}>
                  Not walking
                </span>
              )}
              {dog.door_code && (
                <span style={{ fontSize: 8, color: '#fff', fontWeight: 700, background: '#475569', padding: '1px 4px', borderRadius: 3, flexShrink: 0 }}>
                  #{dog.door_code}
                </span>
              )}
              {isReturned && pickupTime && returnedTime ? (
                <span style={{ fontSize: 9, fontWeight: 600, color: '#B5AFA8', flexShrink: 0 }}>
                  {pickupTime.replace(/ AM| PM/g, '')} → {returnedTime}
                </span>
              ) : isPickedUp && pickupTime ? (
                <span style={{ fontSize: 9, fontWeight: 600, color: '#2D8F6F', flexShrink: 0 }}>{pickupTime}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── NORMAL MODE ──────────────────────────────────────────────
  return (
    <div style={{ marginBottom: 3, position: 'relative' }}>
      {/* Swipe backdrop — behind the card */}
      {swiping && swipeX < 0 && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 12, zIndex: 0,
          background: leftRevealBg,
          display: 'flex', alignItems: 'center',
          justifyContent: 'flex-end', paddingRight: 16,
          color: leftRevealText, fontSize: 13, fontWeight: 700,
        }}>
          {leftRevealContent}
        </div>
      )}
      {swiping && swipeX > 0 && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 12, zIndex: 0,
          background: '#E8634A', display: 'flex', alignItems: 'center',
          paddingLeft: 16,
          color: '#fff', fontSize: 13, fontWeight: 700,
        }}>
          ✏ Note
        </div>
      )}

      {/* ── MINI CARD ───────────────────────────────────────── */}
      <div
        ref={cardRef}
        onClick={() => {
          // State 3 (returned) or not walking: tap does nothing on card body (name tap still works via its own handler)
          if (isReturned || isNotWalking) return;
          if (!isPickedUp) setExpanded(prev => !prev);
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
          cursor: isReturned ? 'default' : 'pointer',
          boxShadow: isReturned ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
          position: 'relative',
          zIndex: 1,
          minHeight: 44,
          opacity: containerOpacity,
          transition: 'opacity 0.2s, background 0.2s',
          transform: swiping ? `translateX(${swipeX}px)` : 'translateX(0)',
          touchAction: 'pan-y',
        }}
      >
        {/* Drag handle */}
        {showDragHandle && !isReturned && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2,
            width: 14, flexShrink: 0, alignItems: 'center', cursor: 'grab' }}>
            <span style={{ display: 'block', width: 12, height: 2, background: '#ccc', borderRadius: 1 }} />
            <span style={{ display: 'block', width: 12, height: 2, background: '#ccc', borderRadius: 1 }} />
            <span style={{ display: 'block', width: 12, height: 2, background: '#ccc', borderRadius: 1 }} />
          </div>
        )}

        {/* Route number / state indicator */}
        {routeNumber != null && (
          <span style={{
            fontSize: isReturned ? 16 : 12, fontWeight: 700,
            width: 20, textAlign: 'center', flexShrink: 0,
            color: isReturned ? '#B5AFA8' : isPickedUp ? '#2D8F6F' : isCurrent ? '#E8634A' : '#aaa',
          }}>
            {isReturned ? '🏠' : isPickedUp ? '✓' : routeNumber}
          </span>
        )}

        {/* Photo */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: photoUrl ? '#f5f5f5' : bgColor,
          opacity: (isPickedUp || isReturned) ? 0.5 : 1,
        }}>
          {photoUrl
            ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{initial}</span>
          }
        </div>

        {/* Level dot */}
        <span style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: levelDot,
        }} />

        {/* Dog name — tap opens profile (ALWAYS purple link, every state) */}
        <span
          onClick={(e) => { if (onTapName) { e.stopPropagation(); onTapName(); } }}
          style={{
            fontSize: 14, fontWeight: 600,
            color: isNotWalking ? '#C4851C' : '#534AB7',
            textDecoration: (isPickedUp || isReturned || isNotWalking) ? 'line-through' : 'none',
            textDecorationColor: isNotWalking ? '#C4851C' : '#534AB7',
            borderBottom: isNotWalking ? '1px dashed #F0C76E' : '1px dashed #AFA9EC',
            letterSpacing: '-0.01em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flexShrink: 1, minWidth: 0,
            cursor: onTapName ? 'pointer' : 'default',
          }}
        >
          {dog.dog_name}
        </span>

        {/* Not walking label */}
        {isNotWalking && (
          <span style={{
            fontSize: 9, color: '#C4851C', fontWeight: 700,
            background: '#FDF3E3', border: '1px solid #F0C76E',
            padding: '2px 6px', borderRadius: 5, flexShrink: 0,
          }}>
            Not walking
          </span>
        )}

        {/* Address — visible in all states */}
        {!isNotWalking && dog.address && (
          <span style={{
            flex: 1, fontSize: 10,
            color: (isPickedUp || isReturned) ? '#B5AFA8' : '#475569',
            fontWeight: 500,
            textAlign: 'right', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {dog.address.split(',')[0]}
          </span>
        )}

        {/* Right side — context-dependent */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {/* State 3: times with arrow */}
          {isReturned && pickupTime && returnedTime && (
            <span style={{ fontSize: 9, fontWeight: 600, color: '#B5AFA8', whiteSpace: 'nowrap' }}>
              {pickupTime} → {returnedTime}
            </span>
          )}

          {/* State 2: pickup time in sage */}
          {isPickedUp && !isReturned && pickupTime && (
            <span style={{ fontSize: 9, fontWeight: 700, color: '#2D8F6F', whiteSpace: 'nowrap' }}>
              {pickupTime}
            </span>
          )}

          {/* Door code — visible when waiting or picked up (not returned, too faded) */}
          {!isReturned && dog.door_code && (
            <span style={{
              fontSize: 9, color: '#fff', fontWeight: 700,
              background: isPickedUp ? '#6DCAA8' : '#475569',
              padding: '2px 6px', borderRadius: 5,
            }}>
              #{dog.door_code}
            </span>
          )}

          {/* Owl indicator dot */}
          {owlNote && !expanded && !isPickedUp && !isReturned && !isNotWalking && (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FAC775', flexShrink: 0 }} />
          )}

          {/* Expand chevron — only when waiting */}
          {!isPickedUp && !isReturned && !isNotWalking && (
            <span style={{
              fontSize: 10, color: '#ccc',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 0.2s',
            }}>
              {'▼'}
            </span>
          )}
        </div>
      </div>

      {/* ── EXPANDED PANEL (waiting state only) ─────────────────── */}
      {expanded && !isPickedUp && !isReturned && (
        <div style={{
          padding: '10px 14px 12px',
          background: '#fafaf8',
          borderRadius: '0 0 12px 12px',
          border: '0.5px solid #E8E4E0',
          borderTop: 'none',
        }}>
          {/* Address row */}
          {dog.address && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span
                onClick={(e) => { e.stopPropagation(); onTapAddress?.() }}
                style={{ fontSize: 13, color: '#185FA5', fontWeight: 500, cursor: 'pointer', flex: 1 }}
              >
                {dog.address} ›
              </span>
            </div>
          )}

          {/* Owl note */}
          {owlNote && (
            <div style={{
              padding: '8px 12px', background: '#FAEEDA',
              border: '0.5px solid #FAC775', borderRadius: 8,
              fontSize: 12, color: '#633806', marginBottom: 8, lineHeight: 1.5,
            }}>
              🦉 {owlNote.note_text}
              {owlNote.created_by_name && (
                <span style={{ color: '#a08050', marginLeft: 6, fontSize: 10 }}>
                  — {owlNote.created_by_name}
                </span>
              )}
            </div>
          )}

          {/* Alt address */}
          {altAddress && (
            <div style={{ padding: '6px 10px', background: '#FAEEDA', borderRadius: 8, fontSize: 11, color: '#854F0B', marginBottom: 8 }}>
              📍 Different address today
            </div>
          )}

          {/* Action buttons */}
          {isLocked && (
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {onSwipeLeft && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSwipeLeft(); setExpanded(false) }}
                  style={{
                    flex: 1, padding: '12px 14px', borderRadius: 10,
                    background: 'linear-gradient(180deg, #2D8F6F 0%, #1f6e53 100%)',
                    color: '#fff', border: 'none',
                    borderBottom: '3px solid #155240',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(45,143,111,0.3)',
                  }}
                >
                  ✓ Picked up
                </button>
              )}
              {onSwipeRight && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSwipeRight() }}
                  style={{
                    flex: 1, padding: '12px 14px', borderRadius: 10,
                    background: 'linear-gradient(180deg, #E8634A 0%, #d4552d 100%)',
                    color: '#fff', border: 'none',
                    borderBottom: '3px solid #b8461f',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(232,99,74,0.3)',
                  }}
                >
                  ✏ Add note
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
