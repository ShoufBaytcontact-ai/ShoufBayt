import prisma from "./prisma.js";
import { toPhoneKey } from "./phone.js";

export class UniqueConflictError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "UniqueConflictError";
    this.status = 409;
    this.code = code;
  }
}

export const sendUniqueConflict = (res, error) => {
  if (!(error instanceof UniqueConflictError)) {
    return false;
  }

  res.status(error.status).json({
    message: error.message,
    code: error.code,
  });
  return true;
};

export const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

export const normalizeUsername = (value) => String(value || "").trim();

export const normalizeLicense = (value) => {
  const key = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s._-]+/g, "");
  return key || null;
};

export const normalizeFullName = (value) => {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return key || null;
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const firstRawDoc = (result) => {
  if (Array.isArray(result) && result.length) return result[0];
  if (Array.isArray(result?.cursor?.firstBatch) && result.cursor.firstBatch.length) {
    return result.cursor.firstBatch[0];
  }
  return null;
};

const notThisUser = (excludeUserId) =>
  excludeUserId ? { _id: { $ne: { $oid: excludeUserId } } } : {};

export const findUsernameOwner = async (username, excludeUserId) => {
  const value = normalizeUsername(username);
  if (!value) return null;

  const result = await prisma.user.findRaw({
    filter: {
      $and: [
        { username: { $regex: `^${escapeRegex(value)}$`, $options: "i" } },
        notThisUser(excludeUserId),
      ].filter((part) => Object.keys(part).length),
    },
    options: {
      limit: 1,
      projection: { _id: 1, username: 1 },
    },
  });

  return firstRawDoc(result);
};

export const findEmailOwner = async (email, excludeUserId) => {
  const value = normalizeEmail(email);
  if (!value) return null;

  const exact = await prisma.user.findUnique({
    where: { email: value },
    select: { id: true },
  });

  if (exact && exact.id !== excludeUserId) {
    return exact;
  }

  const result = await prisma.user.findRaw({
    filter: {
      $and: [
        { email: { $regex: `^${escapeRegex(value)}$`, $options: "i" } },
        notThisUser(excludeUserId),
      ].filter((part) => Object.keys(part).length),
    },
    options: {
      limit: 1,
      projection: { _id: 1, email: 1 },
    },
  });

  return firstRawDoc(result);
};

export const findPhoneOwner = async (phone, excludeUserId) => {
  const key = toPhoneKey(phone);
  if (!key) return null;

  const [users, profiles, applications] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [{ phone: { not: null } }, { pendingPhone: { not: null } }],
        ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
      },
      select: { id: true, phone: true, pendingPhone: true },
    }),
    prisma.agentProfile.findMany({
      where: {
        ...(excludeUserId ? { NOT: { userId: excludeUserId } } : {}),
      },
      select: { userId: true, phone: true },
    }),
    prisma.agentApplication.findMany({
      where: {
        status: { in: ["PENDING", "APPROVED"] },
        ...(excludeUserId ? { NOT: { userId: excludeUserId } } : {}),
      },
      select: { userId: true, phone: true },
    }),
  ]);

  const hit =
    users.find(
      (user) =>
        toPhoneKey(user.phone) === key ||
        toPhoneKey(user.pendingPhone) === key
    ) ||
    profiles.find((profile) => toPhoneKey(profile.phone) === key) ||
    applications.find((application) => toPhoneKey(application.phone) === key);


  return hit ? { id: hit.id || hit.userId } : null;
};

export const findLicenseOwner = async (licenseNumber, excludeUserId) => {
  const key = normalizeLicense(licenseNumber);
  if (!key) return null;

  const applications = await prisma.agentApplication.findMany({
    where: {
      status: { in: ["PENDING", "APPROVED"] },
      ...(excludeUserId ? { NOT: { userId: excludeUserId } } : {}),
      NOT: { licenseNumber: null },
    },
    select: { userId: true, licenseNumber: true },
  });

  const hit = applications.find(
    (application) => normalizeLicense(application.licenseNumber) === key
  );

  return hit || null;
};

export const findFullNameOwner = async (fullName, excludeUserId) => {
  const key = normalizeFullName(fullName);
  if (!key) return null;

  const [profiles, applications] = await Promise.all([
    prisma.agentProfile.findMany({
      where: {
        ...(excludeUserId ? { NOT: { userId: excludeUserId } } : {}),
      },
      select: { userId: true, name: true },
    }),
    prisma.agentApplication.findMany({
      where: {
        status: { in: ["PENDING", "APPROVED"] },
        ...(excludeUserId ? { NOT: { userId: excludeUserId } } : {}),
      },
      select: { userId: true, fullName: true },
    }),
  ]);

  const hit =
    profiles.find((profile) => normalizeFullName(profile.name) === key) ||
    applications.find(
      (application) => normalizeFullName(application.fullName) === key
    );

  return hit ? { id: hit.userId } : null;
};

export const findTransactionOwner = async (transactionId, excludePaymentId) => {
  const value = String(transactionId || "").trim();
  if (!value) return null;

  return prisma.payment.findFirst({
    where: {
      transactionId: value,
      ...(excludePaymentId ? { NOT: { id: excludePaymentId } } : {}),
    },
    select: { id: true, userId: true },
  });
};

export const assertUsernameAvailable = async (username, excludeUserId) => {
  if (await findUsernameOwner(username, excludeUserId)) {
    throw new UniqueConflictError("Username already exists", "USERNAME_TAKEN");
  }
};

export const assertEmailAvailable = async (email, excludeUserId) => {
  if (await findEmailOwner(email, excludeUserId)) {
    throw new UniqueConflictError("Email already exists", "EMAIL_TAKEN");
  }
};

export const assertPhoneAvailable = async (phone, excludeUserId) => {
  if (await findPhoneOwner(phone, excludeUserId)) {
    throw new UniqueConflictError(
      "This phone number is already used on another account",
      "PHONE_TAKEN"
    );
  }
};

export const assertLicenseAvailable = async (licenseNumber, excludeUserId) => {
  if (await findLicenseOwner(licenseNumber, excludeUserId)) {
    throw new UniqueConflictError(
      "This license number is already used by another agent",
      "LICENSE_TAKEN"
    );
  }
};

export const assertFullNameAvailable = async (fullName, excludeUserId) => {
  if (await findFullNameOwner(fullName, excludeUserId)) {
    throw new UniqueConflictError(
      "This full name is already used by another agent",
      "FULL_NAME_TAKEN"
    );
  }
};

export const assertTransactionAvailable = async (
  transactionId,
  excludePaymentId
) => {
  if (await findTransactionOwner(transactionId, excludePaymentId)) {
    throw new UniqueConflictError(
      "This transaction ID was already submitted",
      "TRANSACTION_TAKEN"
    );
  }
};

export const uniqueTargetMessage = (error) => {
  const target = String(
    Array.isArray(error?.meta?.target)
      ? error.meta.target.join(" ")
      : error?.meta?.target || ""
  ).toLowerCase();

  if (target.includes("phone")) {
    return "This phone number is already used on another account";
  }
  if (target.includes("fullname")) {
    return "This full name is already used by another agent";
  }
  if (target.includes("username")) {
    return "Username already exists";
  }
  if (target.includes("google")) {
    return "This Google account is already connected to another user";
  }
  if (target.includes("stripe")) {
    return "This billing customer is already linked to another account";
  }
  if (target.includes("transaction")) {
    return "This transaction ID was already submitted";
  }
  if (target.includes("slug")) {
    return "A listing with this address already exists";
  }
  return "Email already exists";
};
