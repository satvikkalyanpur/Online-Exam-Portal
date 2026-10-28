import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from './prisma.js';

const users = [
  { name: 'Test Student', email: 'student@example.com', password: 'Student@123', role: 'STUDENT' },
  { name: 'Test Teacher', email: 'teacher@example.com', password: 'Teacher@123', role: 'TEACHER' },
  { name: 'Test Admin', email: 'admin@example.com', password: 'Admin@123', role: 'ADMIN' },
] as const;

async function main() {
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, role: u.role, name: u.name },
      create: { name: u.name, email: u.email, passwordHash, role: u.role },
    });
    console.log(`Seeded ${u.email} / ${u.password} (${u.role})`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());