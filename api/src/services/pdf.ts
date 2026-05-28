import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from '@react-pdf/renderer';
import { secondsToMmSs } from '../utils/time';

const styles = StyleSheet.create({
  page: { fontFamily: 'Times-Roman', fontSize: 9, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  headerLeft: { flex: 1 },
  eventName: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  categoryMeta: { fontSize: 9, color: '#555' },
  table: { width: '100%', marginTop: 6 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#eee', borderBottom: '1pt solid #999', paddingVertical: 3 },
  tableRow: { flexDirection: 'row', borderBottom: '0.5pt solid #ccc', paddingVertical: 2 },
  cell: { paddingHorizontal: 3 },
  footer: { position: 'absolute', bottom: 10, left: 20, right: 20, fontSize: 7, color: '#999', textAlign: 'center' },
  // Column widths
  cRank: { width: 25 },
  cName: { width: 100 },
  cCity: { width: 80 },
  cDob: { width: 65 },
  cPlot: { width: 40 },
  cTime: { width: 50 },
  unscored: { fontSize: 10, marginTop: 10, fontStyle: 'italic' },
});

interface EntryData {
  id: string;
  plotNumber: number | null;
  baseTime: number | null;
  penalty: number;
  dnr: boolean;
  rank: number | null;
  participant: {
    firstName: string;
    lastName: string;
    city: string;
    dateOfBirth: string | null;
  };
}

interface TeamData {
  id: string;
  name: string;
  plotNumber: number | null;
  baseTime: number | null;
  penalty: number;
  rank: number | null;
  members: Array<{
    participant: {
      firstName: string;
      lastName: string;
      city: string;
    };
  }>;
}

interface CategoryData {
  id: string;
  name: string;
  plotDimensions: string;
  scored: boolean;
  categoryType: string;
  entries: EntryData[];
  teams: TeamData[];
}

interface EventData {
  name: string;
  date: Date;
  location: string;
  edition: number | null;
  categories: CategoryData[];
}

function CategoryPage({ category, event }: { category: CategoryData; event: EventData }) {
  const dateStr = event.date.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return React.createElement(
    Page,
    { size: 'A4', style: styles.page, wrap: false },
    React.createElement(
      View,
      { style: styles.header },
      React.createElement(
        View,
        { style: styles.headerLeft },
        React.createElement(Text, { style: styles.eventName }, event.name),
        React.createElement(
          Text,
          { style: styles.categoryMeta },
          `Kategória: ${category.name}    ${category.plotDimensions}    ${event.location}, ${dateStr}`
        )
      )
    ),
    category.scored
      ? category.categoryType === 'INDIVIDUAL'
        ? IndividualTable({ entries: category.entries })
        : TeamTable({ teams: category.teams })
      : React.createElement(Text, { style: styles.unscored }, 'nehodnotení'),
    React.createElement(
      Text,
      { style: styles.footer },
      'Softvér: Veselý Kosec · veselykosec.sk'
    )
  );
}

function HeaderRow() {
  return React.createElement(
    View,
    { style: styles.tableHeader },
    React.createElement(Text, { style: [styles.cell, styles.cRank] }, 'Por.'),
    React.createElement(Text, { style: [styles.cell, styles.cName] }, 'Meno'),
    React.createElement(Text, { style: [styles.cell, styles.cCity] }, 'Bydlisko'),
    React.createElement(Text, { style: [styles.cell, styles.cDob] }, 'Dátum nar.'),
    React.createElement(Text, { style: [styles.cell, styles.cPlot] }, 'Políčko'),
    React.createElement(Text, { style: [styles.cell, styles.cTime] }, 'Zákl. čas'),
    React.createElement(Text, { style: [styles.cell, styles.cTime] }, 'Penalizácia'),
    React.createElement(Text, { style: [styles.cell, styles.cTime] }, 'Výsl. čas')
  );
}

function IndividualTable({ entries }: { entries: EntryData[] }) {
  const sorted = [...entries].sort((a, b) => {
    if (a.rank == null && b.rank == null) return 0;
    if (a.rank == null) return 1;
    if (b.rank == null) return -1;
    return a.rank - b.rank;
  });

  return React.createElement(
    View,
    { style: styles.table },
    HeaderRow(),
    ...sorted.map((entry) => {
      const totalTime = entry.dnr ? null : entry.baseTime != null ? entry.baseTime + entry.penalty : null;
      return React.createElement(
        View,
        { style: styles.tableRow, key: entry.id },
        React.createElement(Text, { style: [styles.cell, styles.cRank] }, entry.rank != null ? String(entry.rank) : ''),
        React.createElement(
          Text,
          { style: [styles.cell, styles.cName] },
          `${entry.participant.firstName} ${entry.participant.lastName}`
        ),
        React.createElement(Text, { style: [styles.cell, styles.cCity] }, entry.participant.city),
        React.createElement(Text, { style: [styles.cell, styles.cDob] }, entry.participant.dateOfBirth ?? ''),
        React.createElement(Text, { style: [styles.cell, styles.cPlot] }, entry.plotNumber != null ? String(entry.plotNumber) : ''),
        React.createElement(
          Text,
          { style: [styles.cell, styles.cTime] },
          entry.dnr ? 'DNR' : entry.baseTime != null ? secondsToMmSs(entry.baseTime) : ''
        ),
        React.createElement(
          Text,
          { style: [styles.cell, styles.cTime] },
          entry.dnr ? '' : secondsToMmSs(entry.penalty)
        ),
        React.createElement(
          Text,
          { style: [styles.cell, styles.cTime] },
          totalTime != null ? secondsToMmSs(totalTime) : ''
        )
      );
    })
  );
}

function TeamTable({ teams }: { teams: TeamData[] }) {
  const sorted = [...teams].sort((a, b) => {
    if (a.rank == null && b.rank == null) return 0;
    if (a.rank == null) return 1;
    if (b.rank == null) return -1;
    return a.rank - b.rank;
  });

  const rows: React.ReactElement[] = [];
  for (const team of sorted) {
    const totalTime = team.baseTime != null ? team.baseTime + team.penalty : null;
    // First row: team name + times
    rows.push(
      React.createElement(
        View,
        { style: styles.tableRow, key: `${team.id}-header` },
        React.createElement(Text, { style: [styles.cell, styles.cRank] }, team.rank != null ? String(team.rank) : ''),
        React.createElement(Text, { style: [styles.cell, styles.cName] }, team.name),
        React.createElement(Text, { style: [styles.cell, styles.cCity] }, ''),
        React.createElement(Text, { style: [styles.cell, styles.cDob] }, ''),
        React.createElement(Text, { style: [styles.cell, styles.cPlot] }, team.plotNumber != null ? String(team.plotNumber) : ''),
        React.createElement(Text, { style: [styles.cell, styles.cTime] }, team.baseTime != null ? secondsToMmSs(team.baseTime) : ''),
        React.createElement(Text, { style: [styles.cell, styles.cTime] }, secondsToMmSs(team.penalty)),
        React.createElement(Text, { style: [styles.cell, styles.cTime] }, totalTime != null ? secondsToMmSs(totalTime) : '')
      )
    );
    // Member rows
    for (const member of team.members) {
      rows.push(
        React.createElement(
          View,
          { style: styles.tableRow, key: `${team.id}-${member.participant.firstName}` },
          React.createElement(Text, { style: [styles.cell, styles.cRank] }, ''),
          React.createElement(
            Text,
            { style: [styles.cell, styles.cName] },
            `  ${member.participant.firstName} ${member.participant.lastName}`
          ),
          React.createElement(Text, { style: [styles.cell, styles.cCity] }, member.participant.city),
          React.createElement(Text, { style: [styles.cell, styles.cDob] }, ''),
          React.createElement(Text, { style: [styles.cell, styles.cPlot] }, ''),
          React.createElement(Text, { style: [styles.cell, styles.cTime] }, ''),
          React.createElement(Text, { style: [styles.cell, styles.cTime] }, ''),
          React.createElement(Text, { style: [styles.cell, styles.cTime] }, '')
        )
      );
    }
  }

  return React.createElement(View, { style: styles.table }, HeaderRow(), ...rows);
}

export async function generateResultsPdf(event: EventData): Promise<Buffer> {
  const doc = React.createElement(
    Document,
    null,
    ...event.categories.map((cat) =>
      React.createElement(CategoryPage, { key: cat.id, category: cat, event })
    )
  );
  return renderToBuffer(doc);
}
