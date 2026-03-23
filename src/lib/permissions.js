export function getPermissions(role) {
  return {
    canEditGroups: role === 'admin' || role === 'senior_walker' || role === 'junior_walker',
    canLogWalks: role === 'admin' || role === 'senior_walker',
    canAccessAdmin: role === 'admin',
    canAccessSettings: role === 'admin',
    canSyncAcuity: role === 'admin',
    canAddOwlNotes: role === 'admin' || role === 'senior_walker',
    canSeeAllSectors: role === 'admin',
    canEditDogProfiles: role === 'admin',
    canLockSchedule: role === 'admin',
    canViewMap: true,
    canViewDogProfile: true,
  }
}
