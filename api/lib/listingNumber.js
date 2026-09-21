import prisma from "./prisma.js";

export async function nextListingNumber(db = prisma) {
  const year = new Date().getFullYear();
  const row = await db.listingSequence.upsert({
    where: { year },
    create: { year, nextNumber: 1 },
    update: {},
  });
  const updated = await db.listingSequence.update({
    where: { id: row.id },
    data: { nextNumber: { increment: 1 } },
  });
  const seq = updated.nextNumber - 1;

  return {
    year,
    seq,
    number: `SB-L-${year}-${String(seq).padStart(5, "0")}`,
  };
}
