# Wiggle Design System

## Color Tokens
| Token | Hex | Job |
|---|---|---|
| Coral | #E8634A | Primary action — CTA |
| Coral Dark | #C94A34 | Pressed/active coral |
| Purple | #534AB7 | Tappable links — dog names, walker names |
| Fuschia | #961e78 | Dog has forever note — pay attention |
| Sage | #2D8F6F | Picked up, positive, done |
| Amber | #C4851C | Needs attention, warnings |
| Slate | #475569 | Door codes, addresses |
| Background | #FFF5F0 | Peach — never white |
| Card | #FAF7F4 | Cream — never white |
| Border | #E8E4E0 | Warm gray — never cold gray |
| Text | #333 | Never #000 |

## Typography
- Font: DM Sans (400, 500, 600, 700)
- Touch targets: minimum 44px height

## Dog Card — Always Show
1. Dog name — purple #534AB7 (fuschia if has forever note)
2. Address — street number + name only, no postal code
3. Door code — slate pill #475569
4. Difficulty dot

## Card States
| State | Background | Notes |
|---|---|---|
| Waiting | #FAF7F4 cream | Default |
| Picked up | #E8F5EF sage bg | Show pickup time |
| Back home | #F0ECE8 sand 0.55 opacity | Show both times |
| Not walking | #FDF3E3 amber bg | Amber border + badge |

## Drawer Rules
Close after: Picked Up, Back Home, Not Walking, Undo
Never close after: Edit times, Info taps, Note editing
Door codes always visible — never hidden behind a tap

## Drift Check — Before Shipping Any UI
- Background is peach #FFF5F0, not white
- Cards are cream #FAF7F4, not white
- No cold Tailwind grays
- Dog names are purple or fuschia — never black
- Touch targets ≥ 44px
- Door codes always visible as slate pill
- Font is DM Sans
