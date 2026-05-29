import { PrismaClient, CategoryType, Role } from '@prisma/client';
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

async function upsertUser(email: string, password: string, firstName: string, lastName: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.create({ data: { email, passwordHash, firstName, lastName } });
}

async function upsertEventUser(userId: string, eventId: string, role: Role) {
  return prisma.eventUser.upsert({
    where: { userId_eventId: { userId, eventId } },
    update: { role },
    create: { userId, eventId, role },
  });
}

async function main() {
  // ── Používatelia ──────────────────────────────────────────────────
  const admin      = await upsertUser('majerzdenko@gmail.com', 'SKoStest123',    'Zdenko',  'Majer');
  const rozhodca1  = await upsertUser('rozhodca1@skos.sk',     'Rozhodca123',   'Juraj',   'Blaho');
  const rozhodca2  = await upsertUser('rozhodca2@skos.sk',     'Rozhodca123',   'Martin',  'Sedlák');
  const rozhodca3  = await upsertUser('rozhodca3@skos.sk',     'Rozhodca123',   'Peter',   'Kováč');
  const zapisovatel = await upsertUser('zapisovatel@skos.sk',  'Zapisovatel123','Jana',    'Nováková');

  console.log('Používatelia OK');

  // ── Udalosť 1: ACTIVE (testovacia — žrebovanie + rozhodcovia) ─────
  let activeEvent = await prisma.event.findFirst({ where: { name: 'Testovacia súťaž 2026' } });
  if (!activeEvent) {
    activeEvent = await prisma.event.create({
      data: {
        name: 'Testovacia súťaž 2026',
        date: new Date('2026-07-15T09:00:00'),
        location: 'Liptovský Mikuláš',
        edition: 12,
        status: 'DRAW',
      },
    });

    await upsertEventUser(admin.id,       activeEvent.id, 'ADMIN');
    await upsertEventUser(rozhodca1.id,   activeEvent.id, 'JUDGE');
    await upsertEventUser(rozhodca2.id,   activeEvent.id, 'JUDGE');
    await upsertEventUser(rozhodca3.id,   activeEvent.id, 'JUDGE');
    await upsertEventUser(zapisovatel.id, activeEvent.id, 'REGISTRAR');

    const catDefs: { name: string; plotDimensions: string; plotCount: number; categoryType: CategoryType; scored: boolean; order: number }[] = [
      { name: 'Deti do 16 rokov Profi',       plotDimensions: '5×1,5 m',  plotCount: 23, categoryType: 'INDIVIDUAL', scored: true, order: 0 },
      { name: 'Ženy Profi',                    plotDimensions: '10×1,8 m', plotCount: 23, categoryType: 'INDIVIDUAL', scored: true, order: 1 },
      { name: 'Muži od 16 do 60 rokov Profi',  plotDimensions: '10×1,8 m', plotCount: 23, categoryType: 'INDIVIDUAL', scored: true, order: 2 },
      { name: 'Muži nad 60 rokov Profi',        plotDimensions: '10×1,8 m', plotCount: 23, categoryType: 'INDIVIDUAL', scored: true, order: 3 },
      { name: 'Deti Hobby',                     plotDimensions: '5×1 m',    plotCount: 23, categoryType: 'INDIVIDUAL', scored: true, order: 4 },
      { name: 'Ženy Hobby',                     plotDimensions: '5×1,5 m',  plotCount: 23, categoryType: 'INDIVIDUAL', scored: true, order: 5 },
      { name: 'Muži do 60 rokov Hobby',         plotDimensions: '10×1,8 m', plotCount: 23, categoryType: 'INDIVIDUAL', scored: true, order: 6 },
      { name: 'Muži nad 60 rokov Hobby',        plotDimensions: '10×1,5 m', plotCount: 23, categoryType: 'INDIVIDUAL', scored: true, order: 7 },
      { name: 'Družstvá',                       plotDimensions: '10×10 m',  plotCount: 10, categoryType: 'TEAM',       scored: true, order: 8 },
    ];
    const categories = await Promise.all(
      catDefs.map(c => prisma.category.create({ data: { ...c, eventId: activeEvent!.id } }))
    );

    type CatSeed = { count: number; firstNames: string[]; dobRange: [number, number] };
    const seeds: Record<string, CatSeed> = {
      'Deti do 16 rokov Profi':       { count: 7,  firstNames: K, dobRange: [2011, 2015] },
      'Ženy Profi':                    { count: 9,  firstNames: F, dobRange: [1980, 2005] },
      'Muži od 16 do 60 rokov Profi':  { count: 14, firstNames: M, dobRange: [1965, 2008] },
      'Muži nad 60 rokov Profi':        { count: 8,  firstNames: M, dobRange: [1940, 1963] },
      'Deti Hobby':                     { count: 5,  firstNames: K, dobRange: [2012, 2018] },
      'Ženy Hobby':                     { count: 10, firstNames: F, dobRange: [1975, 2008] },
      'Muži do 60 rokov Hobby':         { count: 12, firstNames: M, dobRange: [1968, 2008] },
      'Muži nad 60 rokov Hobby':        { count: 6,  firstNames: M, dobRange: [1938, 1963] },
    };

    for (const cat of categories) {
      const seed = seeds[cat.name];
      if (!seed) continue;
      for (let i = 0; i < seed.count; i++) {
        const p = await prisma.participant.create({
          data: { eventId: activeEvent!.id, firstName: pick(seed.firstNames), lastName: pick(PRIEZVISKA), city: pick(MESTA), dateOfBirth: dob(seed.dobRange[0], seed.dobRange[1]) },
        });
        await prisma.entry.create({ data: { participantId: p.id, categoryId: cat.id } });
      }
      console.log(`  ${cat.name}: ${seed.count}`);
    }

    const druzstvacat = categories.find(c => c.name === 'Družstvá')!;
    for (const teamName of ['Košiaci z Liptova', 'Turčianski kosci', 'Tatranský oddiel', 'Záhorácki kosci']) {
      const team = await prisma.team.create({ data: { categoryId: druzstvacat.id, name: teamName } });
      for (let i = 0; i < 3; i++) {
        const p = await prisma.participant.create({
          data: { eventId: activeEvent!.id, firstName: pick(M), lastName: pick(PRIEZVISKA), city: pick(MESTA), dateOfBirth: dob(1970, 2000) },
        });
        await prisma.teamMember.create({ data: { teamId: team.id, participantId: p.id } });
      }
    }
    console.log('Udalosť ACTIVE + účastníci vytvorené');
  } else {
    // Ensure roles exist even if event was already seeded
    await upsertEventUser(admin.id,       activeEvent.id, 'ADMIN');
    await upsertEventUser(rozhodca1.id,   activeEvent.id, 'JUDGE');
    await upsertEventUser(rozhodca2.id,   activeEvent.id, 'JUDGE');
    await upsertEventUser(rozhodca3.id,   activeEvent.id, 'JUDGE');
    await upsertEventUser(zapisovatel.id, activeEvent.id, 'REGISTRAR');
    console.log('Udalosť ACTIVE existuje, roly aktualizované');
  }

  // ── Udalosť 2: REGISTRATION (otvorená registrácia) ───────────────
  let regEvent = await prisma.event.findFirst({ where: { name: 'Majstrovstvá okresu 2026' } });
  if (!regEvent) {
    regEvent = await prisma.event.create({
      data: {
        name: 'Majstrovstvá okresu 2026',
        date: new Date('2026-08-23T09:00:00'),
        location: 'Ružomberok',
        edition: 5,
        status: 'REGISTRATION',
      },
    });

    await upsertEventUser(admin.id,       regEvent.id, 'ADMIN');
    await upsertEventUser(zapisovatel.id, regEvent.id, 'REGISTRAR');

    const regCatDefs: { name: string; plotDimensions: string; plotCount: number; categoryType: CategoryType; scored: boolean; order: number }[] = [
      { name: 'Muži Profi',   plotDimensions: '10×1,8 m', plotCount: 20, categoryType: 'INDIVIDUAL', scored: true, order: 0 },
      { name: 'Ženy Profi',   plotDimensions: '10×1,8 m', plotCount: 15, categoryType: 'INDIVIDUAL', scored: true, order: 1 },
      { name: 'Muži Hobby',   plotDimensions: '10×1,5 m', plotCount: 20, categoryType: 'INDIVIDUAL', scored: true, order: 2 },
      { name: 'Deti',         plotDimensions: '5×1 m',    plotCount: 15, categoryType: 'INDIVIDUAL', scored: true, order: 3 },
    ];
    const regCats = await Promise.all(
      regCatDefs.map(c => prisma.category.create({ data: { ...c, eventId: regEvent!.id } }))
    );

    // Niekoľko prihlásených — simuluje prebiehajúcu registráciu
    const regSeeds: Record<string, { count: number; firstNames: string[]; dobRange: [number, number] }> = {
      'Muži Profi':  { count: 6,  firstNames: M, dobRange: [1975, 2007] },
      'Ženy Profi':  { count: 4,  firstNames: F, dobRange: [1980, 2005] },
      'Muži Hobby':  { count: 8,  firstNames: M, dobRange: [1960, 2008] },
      'Deti':        { count: 3,  firstNames: K, dobRange: [2012, 2018] },
    };
    for (const cat of regCats) {
      const seed = regSeeds[cat.name];
      if (!seed) continue;
      for (let i = 0; i < seed.count; i++) {
        const p = await prisma.participant.create({
          data: { eventId: regEvent!.id, firstName: pick(seed.firstNames), lastName: pick(PRIEZVISKA), city: pick(MESTA), dateOfBirth: dob(seed.dobRange[0], seed.dobRange[1]) },
        });
        await prisma.entry.create({ data: { participantId: p.id, categoryId: cat.id } });
      }
    }
    console.log('Udalosť REGISTRATION vytvorená');
  } else {
    console.log('Udalosť REGISTRATION existuje');
  }

  console.log('\n── Prihlasovacie údaje ──────────────────────────────────');
  console.log('Admin:       majerzdenko@gmail.com  /  SKoStest123');
  console.log('Rozhodca 1:  rozhodca1@skos.sk      /  Rozhodca123');
  console.log('Rozhodca 2:  rozhodca2@skos.sk      /  Rozhodca123');
  console.log('Rozhodca 3:  rozhodca3@skos.sk      /  Rozhodca123');
  console.log('Zapisovateľ: zapisovatel@skos.sk    /  Zapisovatel123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
