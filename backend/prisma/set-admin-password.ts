/**
 * One-off helper: give an admin account an email + password so it can sign in
 * to the admin panel. The password is typed into a hidden prompt (never passed
 * on the command line or stored in shell history).
 *
 * Usage (from backend/, with DATABASE_URL set):
 *   npm run admin:set-password -- admin@example.com
 *
 * - If a user with that email exists it must be an ADMIN or SUPER_ADMIN.
 * - Otherwise, if exactly one ADMIN/SUPER_ADMIN user exists, the email is
 *   attached to that user (after you confirm).
 * Existing sessions for the account are revoked.
 */
import 'dotenv/config';
import { randomBytes, scryptSync } from 'node:crypto';
import { createInterface } from 'node:readline';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) throw new Error('Run this command in an interactive terminal.');
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (chunk: string): void => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n' || char === '\u0004') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on('data', onData);
  });
}

function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(secret, salt, 64).toString('hex')}`;
}

async function main(): Promise<void> {
  const emailArg = process.argv[2]?.trim().toLowerCase();
  if (!emailArg || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(emailArg)) {
    throw new Error('Usage: npm run admin:set-password -- <admin-email>');
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set.');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const isAdminRole = (roles: string[]): boolean =>
      roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    let user = await prisma.user.findUnique({ where: { email: emailArg } });
    if (user) {
      if (!isAdminRole(user.roles)) throw new Error('That email belongs to a non-admin account. Aborting.');
    } else {
      const admins = (await prisma.user.findMany({ where: { deletedAt: null } })).filter((candidate) =>
        isAdminRole(candidate.roles),
      );
      if (admins.length !== 1 || !admins[0]) {
        throw new Error(
          `Expected exactly one existing admin to attach this email to, found ${admins.length}. Aborting.`,
        );
      }
      const confirm = await ask(
        `Attach ${emailArg} to the existing admin account ${admins[0].id}? (yes/no) `,
      );
      if (confirm.trim().toLowerCase() !== 'yes') throw new Error('Cancelled.');
      user = await prisma.user.update({ data: { email: emailArg }, where: { id: admins[0].id } });
    }
    const password = await askHidden('New password (input hidden): ');
    const repeat = await askHidden('Repeat password: ');
    if (password !== repeat) throw new Error('Passwords do not match. Nothing was changed.');
    if (!passwordPattern.test(password)) {
      throw new Error('Password must be 8-72 characters with at least one letter and one number.');
    }
    const passwordHash = hashSecret(password);
    await prisma.$transaction([
      prisma.authIdentity.upsert({
        create: {
          email: emailArg,
          passwordHash,
          provider: 'PASSWORD',
          providerSubject: emailArg,
          userId: user.id,
        },
        update: { passwordHash },
        where: { provider_providerSubject: { provider: 'PASSWORD', providerSubject: emailArg } },
      }),
      prisma.refreshToken.updateMany({
        data: { revokedAt: new Date() },
        where: { revokedAt: null, userId: user.id },
      }),
      prisma.userSession.updateMany({ data: { isActive: false }, where: { userId: user.id } }),
    ]);
    console.log(`Done. ${emailArg} can now sign in to the admin panel with the password you entered.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
