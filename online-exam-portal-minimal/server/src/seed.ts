import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from './prisma.js';

async function main() {
  const passwordHash = await bcrypt.hash('Student@123', 10);
  await prisma.user.upsert({
    where: { email: 'student@example.com' },
    update: { passwordHash },
    create: { name: 'Test Student', email: 'student@example.com', passwordHash },
  });
  console.log('Seeded student@example.com / Student@123');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());