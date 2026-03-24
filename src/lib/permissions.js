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
  };
}
