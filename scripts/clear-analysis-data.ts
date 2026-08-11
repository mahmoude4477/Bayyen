import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function counts() {
  const [analyses, runs, results, formSubmissions, assets, outboxEvents, callbackNonces, auditLogs, users, latestAnalysis] = await Promise.all([
    db.analysisSession.count(),
    db.analysisRun.count(),
    db.answerResult.count(),
    db.formSubmission.count(),
    db.submissionAsset.groupBy({ by: ["status"], _count: true }),
    db.outboxEvent.count(),
    db.callbackNonce.count(),
    db.auditLog.count(),
    db.user.count(),
    db.analysisSession.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true, title: true, status: true, inputMode: true, _count: { select: { students: true, formSubmissions: true, assets: true } } } }),
  ]);
  return { analyses, runs, results, formSubmissions, assets, outboxEvents, callbackNonces, auditLogs, users, latestAnalysis };
}

const before = await counts();
if (!process.argv.includes("--confirm")) {
  console.log(JSON.stringify({ mode: "dry-run", before }));
  await db.$disconnect();
  process.exit(0);
}

await db.$transaction(async (tx) => {
  await tx.analysisSession.deleteMany();
  await tx.outboxEvent.deleteMany();
  await tx.callbackNonce.deleteMany();
  await tx.auditLog.deleteMany();
});

const after = await counts();
console.log(JSON.stringify({ mode: "deleted", before, after }));
await db.$disconnect();
