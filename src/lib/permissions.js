export function getPermissions(role) {
  const isChiefPup = role === 'admin';
  const isSeniorOrAbove = role === 'admin' || role === 'senior_walker';
  const isWalker = role === 'senior_walker' || role === 'junior_walker';

  return {
    // EVERYONE can do these
    canCreateGroups: true,
    canMoveDogsToGroups: true,
    canLockGroups: true,
    canUnlockGroups: true,
    canReorderWithinGroup: true,
    canLogPickups: true,
    canLogWalkerNotes: true,
    canViewSchedule: true,
    canAccessSettings: true,

    // SENIOR WALKER + ADMIN
    canAccessAdmin: isSeniorOrAbove,
    canCreateOwlNotes: isSeniorOrAbove,
    canAddOwlNotes: isSeniorOrAbove,

    // SENIOR WALKER + ADMIN (Tower Control)
    canAccessTower: isSeniorOrAbove,
    canEditDogProfiles: isChiefPup,
    canViewClientInfo: isChiefPup,
    canViewAllSectors: isChiefPup,
    canSwitchSectors: isChiefPup,
    canSeeAllSectors: isChiefPup,

    // WALKERS see only their sector
    canViewOwnSectorOnly: isWalker,

    // Backward-compat aliases
    canEditGroups: true,
    canLogWalks: true,
    canLockSchedule: true,
    canViewMap: true,
    canViewDogProfile: true,
  };
}
