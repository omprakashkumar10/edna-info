/**
 * Security Rule Verification Matrix for eDNA BioScan
 * Verifies all 12 "Dirty Dozen" adversarial payloads against Firestore Rules invariants.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
  enforcedByRule: string;
}

export const DIRTY_DOZEN_TESTS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Privilege Escalation on Signup (role: admin)',
    collection: '/users/{userId}',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: "incoming().role == 'user' && incoming().status == 'active'",
  },
  {
    id: 2,
    name: 'Role Mutation on Profile Update',
    collection: '/users/{userId}',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: "incoming().role == existing().role && affectedKeys().hasOnly([...])",
  },
  {
    id: 3,
    name: 'Account Status Bypass (suspended -> active)',
    collection: '/users/{userId}',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: "incoming().status == existing().status",
  },
  {
    id: 4,
    name: 'Shadow Field Injection (ghost key)',
    collection: '/users/{userId}',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'data.keys().hasAll([...]) && data.keys().hasOnly([...])',
  },
  {
    id: 5,
    name: 'Cross-User PII Read',
    collection: '/users/{otherUserId}',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isOwner(userId) || isAdmin()',
  },
  {
    id: 6,
    name: 'Blanket User Directory Scrape',
    collection: '/users',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'allow list: if isAdmin()',
  },
  {
    id: 7,
    name: 'Unverified Admin Email Spoof',
    collection: '/audit_logs/{logId}',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isVerifiedUser() requires request.auth.token.email_verified == true',
  },
  {
    id: 8,
    name: 'Notification Cross-Tenant Query',
    collection: '/notifications',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'resource.data.userId == request.auth.uid || isAdmin()',
  },
  {
    id: 9,
    name: 'Notification Message Forgery',
    collection: '/notifications/{notificationId}',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: "incoming().diff(existing()).affectedKeys().hasOnly(['read'])",
  },
  {
    id: 10,
    name: 'Audit Log Tampering / Unauthorized Read',
    collection: '/audit_logs/{logId}',
    operation: 'delete',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'allow update, delete: if false',
  },
  {
    id: 11,
    name: 'ID Poisoning / Oversized String Field',
    collection: '/users/{userId}',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidId(userId) && data.fullName.size() <= 120',
  },
  {
    id: 12,
    name: 'Client Timestamp Spoofing',
    collection: '/notifications/{notificationId}',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'incoming().createdAt == request.time',
  },
];
