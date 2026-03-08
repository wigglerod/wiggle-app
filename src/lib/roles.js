const ROLE_LABELS = {
  admin: 'Chief Pup',
  senior_walker: 'Wiggle Pro',
  junior_walker: 'Pup Walker',
}

const ROLE_COLORS = {
  admin: 'bg-[#E8634A] text-white',
  senior_walker: 'bg-purple-100 text-purple-700',
  junior_walker: 'bg-green-100 text-green-700',
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || 'Walker'
}

export function roleColor(role) {
  return ROLE_COLORS[role] || 'bg-gray-100 text-gray-500'
}
