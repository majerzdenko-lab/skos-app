import { Resend } from 'resend';
import { prisma } from '../prisma';
import { secondsToMmSs } from '../utils/time';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? 'SKoS <noreply@skos.sk>';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

export async function sendCategoryResults(categoryId: string, eventId: string): Promise<void> {
  try {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        event: true,
        entries: {
          include: { participant: true },
          where: { participant: { emailConsent: true, email: { not: null } } },
        },
      },
    });
    if (!category) return;

    for (const entry of category.entries) {
      const p = entry.participant;
      if (!p.email || !p.emailConsent) continue;

      const totalTime = entry.baseTime != null ? entry.baseTime + entry.penalty : null;
      const totalCount = await prisma.entry.count({
        where: { categoryId, dnr: false, rank: { not: null } },
      });

      let token = p.unsubscribeToken;
      if (!token) {
        const { randomUUID } = await import('crypto');
        token = randomUUID();
        await prisma.participant.update({ where: { id: p.id }, data: { unsubscribeToken: token } });
      }

      await resend.emails.send({
        from: FROM,
        to: p.email,
        subject: `Výsledky: ${category.name} — ${category.event.name}`,
        text: [
          `Dobrý deň, ${p.firstName},`,
          '',
          `kategória ${category.name} na podujatí ${category.event.name} bola uzatvorená.`,
          '',
          'Vaše výsledky:',
          `Políčko: ${entry.plotNumber ?? '—'}`,
          `Základný čas: ${entry.baseTime != null ? secondsToMmSs(entry.baseTime) : '—'}`,
          `Penalizácia: ${secondsToMmSs(entry.penalty)}`,
          `Výsledný čas: ${totalTime != null ? secondsToMmSs(totalTime) : '—'}`,
          `Umiestnenie: ${entry.rank != null ? `${entry.rank}. miesto z ${totalCount} súťažiacich` : 'DNR'}`,
          '',
          `Celková výsledková listina: ${FRONTEND_URL}/events/${eventId}/results`,
          '',
          '—',
          'Slovenský kosecký spolok',
          `Softvér: Veselý Kosec · veselykosec.sk`,
          '',
          `Odhlásiť sa zo zasielania správ: ${FRONTEND_URL}/unsubscribe/${token}`,
        ].join('\n'),
      });
    }
  } catch (err) {
    console.error('Email send error (category results):', err);
  }
}

export async function sendEventAnnouncement(eventId: string): Promise<void> {
  try {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return;

    const dateStr = event.date.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const participants = await prisma.participant.findMany({
      where: { emailConsent: true, email: { not: null } },
      select: { id: true, email: true, unsubscribeToken: true },
    });

    // Deduplicate by email
    const seen = new Set<string>();
    const unique = participants.filter((p) => {
      if (!p.email || seen.has(p.email)) return false;
      seen.add(p.email);
      return true;
    });

    for (const p of unique) {
      if (!p.email) continue;

      let token = p.unsubscribeToken;
      if (!token) {
        const { randomUUID } = await import('crypto');
        token = randomUUID();
        await prisma.participant.update({ where: { id: p.id }, data: { unsubscribeToken: token } });
      }

      await resend.emails.send({
        from: FROM,
        to: p.email,
        subject: `Nové podujatie: ${event.name} — ${dateStr}`,
        text: [
          'Dobrý deň,',
          '',
          'Slovenský kosecký spolok vypisuje nové podujatie:',
          '',
          event.name,
          `Dátum: ${dateStr}`,
          `Miesto: ${event.location}`,
          '',
          `Registrácia je otvorená:`,
          `${FRONTEND_URL}/events/${eventId}/register`,
          '',
          `Ak si neželáte dostávať tieto správy, odhláste sa tu:`,
          `${FRONTEND_URL}/unsubscribe/${token}`,
          '',
          '—',
          'Slovenský kosecký spolok',
          'Softvér: Veselý Kosec · veselykosec.sk',
        ].join('\n'),
      });
    }
  } catch (err) {
    console.error('Email send error (announcement):', err);
  }
}
