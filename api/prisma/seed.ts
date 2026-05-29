import { PrismaClient, CategoryType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const M = ['Peter', 'Ján', 'Miroslav', 'Tibor', 'Ondrej', 'Rastislav', 'Dušan', 'Vladimír', 'Michal', 'Tomáš', 'Juraj', 'Pavol', 'Martin', 'Lukáš', 'Robert', 'Jozef', 'Milan', 'Ivan', 'Karol', 'Stanislav'];
const F = ['Mária', 'Eva', 'Jana', 'Zuzana', 'Katarína', 'Monika', 'Lucia', 'Andrea', 'Veronika', 'Petra', 'Alžbeta', 'Helena', 'Ivana'];
const K = ['Marek', 'Filip', 'Jakub', 'Kristína', 'Barbora', 'Adam', 'Dominika', 'Matúš', 'Natália', 'Lukáš'];
const PRIEZVISKA = ['Novák', 'Horváth', 'Kováč', 'Varga', 'Tóth', 'Baláž', 'Oravec', 'Sedlák', 'Ferko', 'Gál', 'Hudák', 'Jurček', 'Krajči', 'Lukáč', 'Moravec', 'Polák', 'Rybár', 'Šimko', 'Urban', 'Vlček', 'Mináč', 'Blaho', 'Taraba', 'Ivanič', 'Mičura'];
const MESTA = ['Bratislava', 'Košice', 'Prešov', 'Žilina', 'Banská Bystrica', 'Nitra', 'Trnava', 'Trenčín', 'Martin', 'Poprad', 'Liptovský Mikuláš', 'Zvolen', 'Ružomberok', 'Spišská Nová Ves', 'Levice', 'Michalovce', 'Piešťany', 'Brezno', 'Čadca', 'Stará Ľubovňa'];

function dob(minY: number, maxY: number): string {
  const y = minY + Math.floor(Math.random() * (maxY - minY + 1));
  const m = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const d = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  return `${d}.${m}.${y}`;
}

async function main() {
  // Admin user
  let admin = await prisma.user.findUnique({ where: { email: 'majerzdenko@gmail.com' } });
  if (!admin) {
    const passwordHash = await bcrypt.hash('SKoStest123', 12);
    admin = await prisma.user.create({
      data: { email: 'majerzdenko@gmail.com', passwordHash, firstName: 'Zdenko', lastName: 'Majer' },
    });
    console.log('Admin vytvorený');
  } else {
    console.log('Admin existuje');
  }

  // Skip if test event already exists
  const exists = await prisma.event.findFirst({ where: { name: 'Testovacia súťaž 2026' } });
  if (exists) {
    console.log('Testovacia udalosť už existuje, seed preskočený');
    return;
  }

  const event = await prisma.event.create({
    data: {
      name: 'Testovacia súťaž 2026',
      date: new Date('2026-07-15T09:00:00'),
      location: 'Liptovský Mikuláš',
      edition: 12,
      status: 'ACTIVE',
    },
  });

  await prisma.eventUser.create({
    data: { userId: admin.id, eventId: event.id, role: 'ADMIN' },
  });

  const catDefs: { name: string; plotDimensions: string; plotCount: number; categoryType: CategoryType; scored: boolean; order: number }[] = [
    { name: 'Deti do 16 rokov Profi', plotDimensions: '5×1,5 m', plotCount: 23, categoryType: 'INDIVIDUAL', scored: true, order: 0 },
    { name: 'Ženy Profi',              plotDimensions: '10×1,8 m', plotCount: 23, categoryType: 'INDIVIDUAL', scored: true, order: 1 },
    { name: 'Muži od 16 do 60 rokov Profi', plotDimensions: '10×1,8 m', plotCount: 23, categoryType: 'INDIVIDUAL', scored: true, order: 2 },
    { name: 'Muži nad 60 rokov Profi', plotDimensions: '10×1,8 m', plotCount: 23, categoryType: 'INDIVIDUAL', scored: true, order: 3 },
    { name: 'Deti Hobby',              plotDimensions: '5×1 m',   plotCount: 23, categoryType: 'INDIVIDUAL', scored: true, order: 4 },
    { name: 'Ženy Hobby',              plotDimensions: '5×1,5 m', plotCount: 23, categoryType: 'INDIVIDUAL', scored: true, order: 5 },
    { name: 'Muži do 60 rokov Hobby',  plotDimensions: '10×1,8 m', plotCount: 23, categoryType: 'INDIVIDUAL', scored: true, order: 6 },
    { name: 'Muži nad 60 rokov Hobby', plotDimensions: '10×1,5 m', plotCount: 23, categoryType: 'INDIVIDUAL', scored: true, order: 7 },
    { name: 'Družstvá',                plotDimensions: '10×10 m', plotCount: 10, categoryType: 'TEAM',       scored: true, order: 8 },
  ];

  const categories = await Promise.all(
    catDefs.map(c => prisma.category.create({ data: { ...c, eventId: event.id } }))
  );

  type CatSeed = { count: number; firstNames: string[]; dobRange: [number, number] };
  const seeds: Record<string, CatSeed> = {
    'Deti do 16 rokov Profi':      { count: 7,  firstNames: K, dobRange: [2011, 2015] },
    'Ženy Profi':                   { count: 9,  firstNames: F, dobRange: [1980, 2005] },
    'Muži od 16 do 60 rokov Profi': { count: 14, firstNames: M, dobRange: [1965, 2008] },
    'Muži nad 60 rokov Profi':      { count: 8,  firstNames: M, dobRange: [1940, 1963] },
    'Deti Hobby':                   { count: 5,  firstNames: K, dobRange: [2012, 2018] },
    'Ženy Hobby':                   { count: 10, firstNames: F, dobRange: [1975, 2008] },
    'Muži do 60 rokov Hobby':       { count: 12, firstNames: M, dobRange: [1968, 2008] },
    'Muži nad 60 rokov Hobby':      { count: 6,  firstNames: M, dobRange: [1938, 1963] },
  };

  for (const cat of categories) {
    const seed = seeds[cat.name];
    if (!seed) continue;
    for (let i = 0; i < seed.count; i++) {
      const p = await prisma.participant.create({
        data: {
          eventId: event.id,
          firstName: pick(seed.firstNames),
          lastName: pick(PRIEZVISKA),
          city: pick(MESTA),
          dateOfBirth: dob(seed.dobRange[0], seed.dobRange[1]),
        },
      });
      await prisma.entry.create({ data: { participantId: p.id, categoryId: cat.id } });
    }
    console.log(`${cat.name}: ${seed.count} účastníkov`);
  }

  // Družstvá — 4 tímy × 3 členovia
  const druzstvacat = categories.find(c => c.name === 'Družstvá')!;
  const teamNames = ['Košiaci z Liptova', 'Turčianski kosci', 'Tatranský oddiel', 'Záhorácki kosci'];
  for (const teamName of teamNames) {
    const team = await prisma.team.create({ data: { categoryId: druzstvacat.id, name: teamName } });
    for (let i = 0; i < 3; i++) {
      const p = await prisma.participant.create({
        data: {
          eventId: event.id,
          firstName: pick(M),
          lastName: pick(PRIEZVISKA),
          city: pick(MESTA),
          dateOfBirth: dob(1970, 2000),
        },
      });
      await prisma.teamMember.create({ data: { teamId: team.id, participantId: p.id } });
    }
  }
  console.log('Družstvá: 4 tímy × 3 členovia');
  console.log(`\nSeed hotový! Event ID: ${event.id}`);
  console.log('Login: majerzdenko@gmail.com / SKoStest123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
