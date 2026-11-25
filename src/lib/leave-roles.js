// Single source of truth for Leave Management roles and departments.
// Every role code is <= 15 chars to fit comfortably within Prisma @db.VarChar(20).

export const LEAVE_ROLES = [
  { value: 'TRAINING_INTERN', label: '1. Training Intern', tier: 'EMPLOYEE' },
  { value: 'BDA_INTERN', label: '2. BDA Intern', tier: 'EMPLOYEE' },
  { value: 'LGA_INTERN', label: '3. LGA Intern', tier: 'EMPLOYEE' },
  { value: 'PROBATION', label: '4. Probation', tier: 'EMPLOYEE' },
  { value: 'BDE_FULLTIME', label: '5. BDE Full Time', tier: 'EMPLOYEE' },
  { value: 'LGE_FULLTIME', label: '6. LGE Full Time', tier: 'EMPLOYEE' },
  { value: 'COORDINATOR', label: '7. Coordinator', tier: 'EMPLOYEE' },
  { value: 'SR_BDE', label: '8. SR. BDE', tier: 'EMPLOYEE' },
  { value: 'SR_LGE', label: '9. SR. LGE', tier: 'EMPLOYEE' },
  { value: 'TL_SALES', label: '10. Team Lead Sales', tier: 'TL' },
  { value: 'TL_MARKETING', label: '11. Team Lead Marketing', tier: 'TL' },
  { value: 'OPS_EXECUTIVE', label: '12. Operations Executive', tier: 'EMPLOYEE' },
  { value: 'SUPPORT_EXEC', label: '13. Supporting Executive', tier: 'EMPLOYEE' },
  { value: 'VIDEO_EDITING', label: '14. Video Editing', tier: 'EMPLOYEE' },
  { value: 'HR', label: '15. Human Resource', tier: 'HR' },
  { value: 'HR_TL', label: '16. HR TL', tier: 'HR' },
  { value: 'SR_HR', label: '17. SR. Human Resource', tier: 'HR' },
  { value: 'SR_TL_SALES', label: '18. SR. Team Lead Sales', tier: 'TL' },
  { value: 'SR_TL_MARKETING', label: '19. SR. Team Lead Marketing', tier: 'TL' },
  { value: 'SALES_HEAD', label: '20. Sales Head', tier: 'MANAGER' },
  { value: 'MARKETING_HEAD', label: '21. Marketing Head', tier: 'MANAGER' },
  { value: 'BRANCH_MANAGER', label: '22. Branch Manager', tier: 'MANAGER' },
  { value: 'GENERAL_MANAGER', label: '23. General Manager', tier: 'MANAGER' },
];

export const LEGACY_LEAVE_ROLES = {
  EMPLOYEE: 'Employee',
  TEAM_LEADER: 'Team Leader',
  INTERN: 'Intern',
  FULLTIME: 'Fulltime',
  MANAGER: 'Manager',
  ADMIN: 'Admin',
};

export const ALL_VALID_LEAVE_ROLES = [
  ...LEAVE_ROLES.map((r) => r.value),
  ...Object.keys(LEGACY_LEAVE_ROLES),
];

export const TL_ROLES = [
  'TEAM_LEADER',
  ...LEAVE_ROLES.filter((r) => r.tier === 'TL').map((r) => r.value),
];

export const HR_ROLES = [
  ...LEAVE_ROLES.filter((r) => r.tier === 'HR').map((r) => r.value),
];

export const MANAGER_ROLES = [
  'MANAGER',
  'ADMIN',
  ...LEAVE_ROLES.filter((r) => r.tier === 'MANAGER').map((r) => r.value),
];

export const LEAVE_ROLE_LABELS = {
  ...LEGACY_LEAVE_ROLES,
  ...Object.fromEntries(
    LEAVE_ROLES.map((r) => [r.value, r.label.replace(/^\d+\.\s*/, '')]),
  ),
};

export function getLeaveRoleDashboard(empRole) {
  if (MANAGER_ROLES.includes(empRole)) return '/leave/admin/dashboard';
  if (HR_ROLES.includes(empRole)) return '/leave/hr/dashboard';
  if (TL_ROLES.includes(empRole)) return '/leave/tl/dashboard';
  return '/leave/employee/dashboard';
}

export const LEAVE_DEPARTMENTS = [
  'Sales',
  'Marketing',
  'Operations',
  'Supporting',
  'Video Editing',
  'HR',
  'Finance & Audit',
  'Product Development Team',
];
