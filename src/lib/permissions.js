export function getPermissions(role) {
  const isAdmin = role === 'admin';
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

    // ADMIN ONLY
    canEditDogProfiles: isAdmin,
    canViewClientInfo: isAdmin,
    canViewAllSectors: isAdmin,
    canCreateOwlNotes: isAdmin,
    canSwitchSectors: isAdmin,

    // WALKERS see only their sector
    canViewOwnSectorOnly: isWalker,

    // Backward-compat aliases (used by pages not yet migrated to V3 names)
    canEditGroups: true,
    canLogWalks: true,
    canAccessAdmin: isAdmin,
    canAccessSettings: isAdmin,
    canSeeAllSectors: isAdmin,
    canAddOwlNotes: isAdmin,
    canLockSchedule: true,
    canViewMap: true,
    canViewDogProfile: true,
  };
}
