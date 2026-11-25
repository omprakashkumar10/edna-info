# eDNA BioScan Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Identity & Role Integrity**: Every user document at `/users/{userId}` must have `uid == request.auth.uid == userId` on creation, `role == 'user'`, and `status == 'active'`. Standard users can never self-assign `role == 'admin'` or modify `role`, `status`, `uid`, or `createdAt`.
2. **PII Isolation**: `/users/{userId}` contains email, mobile number, and institution details. `get` is restricted to the document owner or a verified administrator (`isAdmin()`). `list` is restricted strictly to verified administrators.
3. **Notification Scoping**: `/notifications/{notificationId}` records are strictly scoped to `userId`. Queries (`list`) must filter by `resource.data.userId == request.auth.uid` (or be executed by an admin). Users may only update the `read` boolean on their own notifications.
4. **Admin & Audit Protection**: `/audit_logs/{logId}` is read-only/append-only for verified administrators (`isAdmin()`) and completely inaccessible to standard users. Audit log documents are immutable once written (`update` and `delete` are forbidden).
5. **Path & Size Bounds**: Every document ID must match `^[a-zA-Z0-9_\-]+$` and be $\le 128$ chars. Every string field enforces explicit `.size()` bounds. Timestamps (`createdAt`, `updatedAt`) must equal `request.time`.

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. **Privilege Escalation on Signup**: `POST /users/{uid}` with `{ role: 'admin', status: 'active' }` as a non-admin user.
2. **Role Mutation on Profile Update**: `PATCH /users/{uid}` changing `role` from `'user'` to `'admin'`.
3. **Account Status Bypass**: `PATCH /users/{uid}` changing `status` from `'suspended'` to `'active'`.
4. **Shadow Field Injection**: `POST /users/{uid}` including an undeclared ghost field `{ isVerifiedAdmin: true }`.
5. **Cross-User PII Read**: `GET /users/{otherUid}` by an authenticated non-admin user.
6. **Blanket User Directory Scrape**: `LIST /users` by an authenticated non-admin user.
7. **Unverified Admin Email Spoof**: Request with `token.email == 'omprakash773919@gmail.com'` and `token.email_verified == false` attempting admin read/write.
8. **Notification Cross-Tenant Query**: `LIST /notifications` without `userId == request.auth.uid` filter by a non-admin user.
9. **Notification Message Forgery**: `PATCH /notifications/{id}` attempting to modify `title` or `message` instead of only `read`.
10. **Audit Log Tampering**: `DELETE /audit_logs/{id}` or `PATCH /audit_logs/{id}` even by an admin, or `GET /audit_logs/{id}` by a normal user.
11. **ID Poisoning / Resource Exhaustion**: `SET /users/{1500-char-id}` or injecting a 500KB string into `fullName`.
12. **Client Timestamp Spoofing**: `CREATE /notifications/{id}` with a backdated `createdAt` not equal to `request.time`.
