const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ADMINS = [
  {
    nombre: 'Ivan',
    username: 'Ivan_admid',
    numeroEmpleado: 'EMP-001',
    email: 'ivan.admin@laherradura.com',
    cargo: 'Administrador del Sistema',
  },
  {
    nombre: 'Ale',
    username: 'ale_admid',
    numeroEmpleado: 'EMP-002',
    email: 'ale.admin@laherradura.com',
    cargo: 'Administrador del Sistema',
  },
];

const PASSWORD = 'TiHerradura2022';

async function main() {
  console.log('🌱 Iniciando seed...');

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  for (const admin of ADMINS) {
    await prisma.usuario.upsert({
      where: { username: admin.username },
      update: {},
      create: {
        nombre: admin.nombre,
        username: admin.username,
        numeroEmpleado: admin.numeroEmpleado,
        email: admin.email,
        cargo: admin.cargo,
        password: passwordHash,
        rol: 'ADMIN',
      },
    });
    console.log(`✅ Usuario ADMIN creado — usuario: ${admin.username} / contraseña: ${PASSWORD}`);
  }
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
