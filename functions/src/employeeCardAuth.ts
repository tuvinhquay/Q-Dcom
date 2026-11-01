import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const scrypt = promisify(scryptCallback);
const PIN_PATTERN = /^\d{6}$/;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const HASH_BYTES = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

type EmployeeCredential = {
  tenantId: string;
  uid: string;
  employeeCode: string;
  salt: string;
  pinHash: string;
  active: boolean;
};

function normalizeCode(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validPin(value: unknown): value is string {
  return typeof value === "string" && PIN_PATTERN.test(value);
}

function opaqueKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function hashPin(pin: string, salt: Buffer): Promise<Buffer> {
  return await scrypt(pin, salt, HASH_BYTES, SCRYPT_OPTIONS) as Buffer;
}

async function matchesPin(pin: string, saltHex: string, expectedHex: string): Promise<boolean> {
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(expectedHex, "hex");
    if (salt.length !== 16 || expected.length !== HASH_BYTES) return false;
    const actual = await hashPin(pin, salt);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function consumeAttempt(key: string): Promise<{ allowed: boolean; lockedUntil?: number }> {
  const db = getFirestore();
  const ref = db.collection("employeeLoginAttempts").doc(key);
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const now = Date.now();
    const data = snapshot.data();
    const lockedUntil = Number(data?.lockedUntil ?? 0);
    if (lockedUntil > now) return { allowed: false, lockedUntil };

    const failedAttempts = Number(data?.failedAttempts ?? 0);
    const nextAttempts = failedAttempts + 1;
    const nextLock = nextAttempts >= MAX_FAILED_ATTEMPTS ? now + LOCK_DURATION_MS : 0;
    tx.set(ref, {
      failedAttempts: nextAttempts,
      lockedUntil: nextLock,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return nextAttempts >= MAX_FAILED_ATTEMPTS
      ? { allowed: false, lockedUntil: nextLock }
      : { allowed: true };
  });
}

async function recordFailure(key: string): Promise<void> {
  const db = getFirestore();
  const ref = db.collection("employeeLoginAttempts").doc(key);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    const attempts = Number(data?.failedAttempts ?? 0);
    const lockedUntil = Number(data?.lockedUntil ?? 0);
    if (lockedUntil > Date.now()) return;
    const next = Math.max(attempts, 1);
    tx.set(ref, {
      failedAttempts: next,
      lockedUntil: next >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCK_DURATION_MS : 0,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function clearAttempts(key: string): Promise<void> {
  await getFirestore().collection("employeeLoginAttempts").doc(key).delete();
}

async function verifyActiveTenantAndMembership(tenantId: string, uid: string, employeeCode: string) {
  const db = getFirestore();
  const tenantRef = db.collection("tenants").doc(tenantId);
  const memberRef = tenantRef.collection("members").doc(uid);
  const [tenantSnap, memberSnap] = await Promise.all([tenantRef.get(), memberRef.get()]);
  if (!tenantSnap.exists || tenantSnap.data()?.active !== true || !memberSnap.exists) return null;
  const member = memberSnap.data()!;
  if (member.active !== true || member.tenantId !== tenantId || member.uid !== uid ||
      member.employeeCode !== employeeCode || !["admin", "worker"].includes(member.role)) return null;
  return member;
}

/** Public sign-in endpoint. Membership and tenant data are always resolved server-side. */
export const loginWithEmployeeCard = onCall({ maxInstances: 10 }, async (request) => {
  const tenantId = typeof request.data?.tenantId === "string" ? request.data.tenantId.trim() : "";
  const employeeCode = normalizeCode(request.data?.employeeCode);
  const pin = request.data?.pin;
  if (!/^[A-Za-z0-9_-]{3,80}$/.test(tenantId) || !/^[A-Za-z0-9_-]{2,32}$/.test(employeeCode) || !validPin(pin)) {
    throw new HttpsError("invalid-argument", "Thông tin đăng nhập không hợp lệ.");
  }

  const ip = request.rawRequest.ip ?? "unknown";
  const attemptKey = opaqueKey([tenantId, employeeCode, ip].join("|"));
  const attempt = await consumeAttempt(attemptKey);
  if (!attempt.allowed) {
    throw new HttpsError("resource-exhausted", "Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.");
  }

  const db = getFirestore();
  const members = await db.collection("tenants").doc(tenantId).collection("members")
    .where("employeeCode", "==", employeeCode).limit(2).get();

  let valid = false;
  let uid = "";
  if (members.size === 1) {
    uid = members.docs[0].id;
    const member = await verifyActiveTenantAndMembership(tenantId, uid, employeeCode);
    const credentialSnap = await db.collection("tenants").doc(tenantId)
      .collection("employeeCredentials").doc(uid).get();
    if (member && credentialSnap.exists) {
      const credential = credentialSnap.data() as EmployeeCredential;
      valid = credential.active === true && credential.tenantId === tenantId &&
        credential.uid === uid && credential.employeeCode === employeeCode &&
        await matchesPin(pin, credential.salt, credential.pinHash);
    }
  }

  if (!valid) {
    // Run a cost-equivalent hash when the card/credential does not exist.
    if (members.size !== 1) await hashPin(pin, Buffer.alloc(16, 7));
    throw new HttpsError("unauthenticated", "Mã thẻ hoặc PIN không chính xác, hoặc tài khoản không hoạt động.");
  }

  await clearAttempts(attemptKey);
  const customToken = await getAuth().createCustomToken(uid, { authMethod: "employee_card" });
  return { customToken };
});

/** An active tenant Admin may set/reset a PIN for an active Worker in the same tenant. */
export const setEmployeeCardPin = onCall({ maxInstances: 10 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Vui lòng đăng nhập bằng tài khoản quản lý.");
  const tenantId = typeof request.data?.tenantId === "string" ? request.data.tenantId.trim() : "";
  const targetUid = typeof request.data?.employeeUid === "string" ? request.data.employeeUid.trim() : "";
  const pin = request.data?.pin;
  if (!/^[A-Za-z0-9_-]{3,80}$/.test(tenantId) || !/^[A-Za-z0-9]{1,128}$/.test(targetUid) || !validPin(pin)) {
    throw new HttpsError("invalid-argument", "Thông tin cấp PIN không hợp lệ. PIN phải gồm đúng 6 chữ số.");
  }

  const db = getFirestore();
  const tenantRef = db.collection("tenants").doc(tenantId);
  const [tenantSnap, adminSnap, workerSnap] = await Promise.all([
    tenantRef.get(),
    tenantRef.collection("members").doc(request.auth.uid).get(),
    tenantRef.collection("members").doc(targetUid).get(),
  ]);
  if (!tenantSnap.exists || tenantSnap.data()?.active !== true ||
      !adminSnap.exists || adminSnap.data()?.active !== true ||
      adminSnap.data()?.role !== "admin" || adminSnap.data()?.tenantId !== tenantId ||
      !workerSnap.exists || workerSnap.data()?.active !== true ||
      workerSnap.data()?.role !== "worker" || workerSnap.data()?.tenantId !== tenantId ||
      workerSnap.data()?.uid !== targetUid) {
    throw new HttpsError("permission-denied", "Bạn không có quyền cấp PIN cho nhân viên này.");
  }

  const employeeCode = normalizeCode(workerSnap.data()?.employeeCode);
  if (!employeeCode) throw new HttpsError("failed-precondition", "Nhân viên chưa có mã thẻ hợp lệ.");
  const duplicate = await tenantRef.collection("members").where("employeeCode", "==", workerSnap.data()?.employeeCode).limit(2).get();
  if (duplicate.size !== 1 || duplicate.docs[0].id !== targetUid) {
    throw new HttpsError("failed-precondition", "Mã thẻ nhân viên bị trùng trong xưởng.");
  }

  const salt = randomBytes(16);
  const pinHash = await hashPin(pin, salt);
  await tenantRef.collection("employeeCredentials").doc(targetUid).set({
    tenantId,
    uid: targetUid,
    employeeCode,
    salt: salt.toString("hex"),
    pinHash: pinHash.toString("hex"),
    active: true,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid,
  });
  return { success: true };
});
