import { secondsToMmSs, formatEventDate } from '../utils/time';
import type { Category, Event, EntryWithParticipant, Team } from '../api/endpoints';

interface Props {
  event: Event;
  categories: Array<
    Category & {
      entries?: EntryWithParticipant[];
      teams?: Team[];
    }
  >;
}

export default function ResultsSheet({ event, categories }: Props) {
  return (
    <div className="font-serif text-sm results-sheet">
      {categories.map((cat) => (
        <div key={cat.id} className="category-page mb-8 print:break-after-page">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="text-xl font-bold">{event.name}</div>
              <div className="text-sm text-gray-600">
                Kategória: {cat.name} &nbsp;&nbsp; {cat.plotDimensions} &nbsp;&nbsp; {event.location},{' '}
                {formatEventDate(event.date)}
              </div>
            </div>
          </div>

          {cat.scored ? (
            cat.categoryType === 'INDIVIDUAL' ? (
              <IndividualTable entries={cat.entries ?? []} />
            ) : (
              <TeamTable teams={cat.teams ?? []} />
            )
          ) : (
            <p className="italic text-gray-500 mt-4">nehodnotení</p>
          )}
        </div>
      ))}

      <div className="print:block hidden mt-4 text-xs text-gray-400 text-center">
        Softvér: Veselý Kosec · veselykosec.sk
      </div>
    </div>
  );
}

function IndividualTable({ entries }: { entries: EntryWithParticipant[] }) {
  const sorted = [...entries].sort((a, b) => {
    if (a.rank == null && b.rank == null) return 0;
    if (a.rank == null) return 1;
    if (b.rank == null) return -1;
    return a.rank - b.rank;
  });

  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="bg-gray-100 border-b border-gray-400">
          <th className="text-left px-2 py-1 w-10">Por.</th>
          <th className="text-left px-2 py-1 w-36">Meno</th>
          <th className="text-left px-2 py-1 w-28">Bydlisko</th>
          <th className="text-left px-2 py-1 w-24">Dátum nar.</th>
          <th className="text-right px-2 py-1 w-16">Políčko</th>
          <th className="text-right px-2 py-1 w-20">Zákl. čas</th>
          <th className="text-right px-2 py-1 w-20">Penalizácia</th>
          <th className="text-right px-2 py-1 w-20">Výsl. čas</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((entry) => {
          const totalTime = entry.dnr ? null : entry.baseTime != null ? entry.baseTime + entry.penalty : null;
          return (
            <tr key={entry.id} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="px-2 py-1 font-semibold">{entry.rank ?? ''}</td>
              <td className="px-2 py-1">
                {entry.participant.firstName} {entry.participant.lastName}
              </td>
              <td className="px-2 py-1">{entry.participant.city}</td>
              <td className="px-2 py-1 text-gray-500">{entry.participant.dateOfBirth ?? ''}</td>
              <td className="px-2 py-1 text-right">{entry.plotNumber ?? ''}</td>
              <td className="px-2 py-1 text-right font-mono">
                {entry.dnr ? 'DNR' : entry.baseTime != null ? secondsToMmSs(entry.baseTime) : ''}
              </td>
              <td className="px-2 py-1 text-right font-mono">
                {entry.dnr ? '' : secondsToMmSs(entry.penalty)}
              </td>
              <td className="px-2 py-1 text-right font-mono font-semibold">
                {totalTime != null ? secondsToMmSs(totalTime) : ''}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TeamTable({ teams }: { teams: Team[] }) {
  const sorted = [...teams].sort((a, b) => {
    if (a.rank == null && b.rank == null) return 0;
    if (a.rank == null) return 1;
    if (b.rank == null) return -1;
    return a.rank - b.rank;
  });

  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="bg-gray-100 border-b border-gray-400">
          <th className="text-left px-2 py-1 w-10">Por.</th>
          <th className="text-left px-2 py-1 w-40">Názov / Meno</th>
          <th className="text-left px-2 py-1 w-28">Bydlisko</th>
          <th className="text-right px-2 py-1 w-16">Políčko</th>
          <th className="text-right px-2 py-1 w-20">Zákl. čas</th>
          <th className="text-right px-2 py-1 w-20">Penalizácia</th>
          <th className="text-right px-2 py-1 w-20">Výsl. čas</th>
        </tr>
      </thead>
      <tbody>
        {sorted.flatMap((team) => {
          const totalTime = team.baseTime != null ? team.baseTime + team.penalty : null;
          return [
            <tr key={team.id} className="border-b border-gray-300 bg-gray-50">
              <td className="px-2 py-1 font-semibold">{team.rank ?? ''}</td>
              <td className="px-2 py-1 font-semibold">{team.name}</td>
              <td className="px-2 py-1"></td>
              <td className="px-2 py-1 text-right">{team.plotNumber ?? ''}</td>
              <td className="px-2 py-1 text-right font-mono">
                {team.baseTime != null ? secondsToMmSs(team.baseTime) : ''}
              </td>
              <td className="px-2 py-1 text-right font-mono">{secondsToMmSs(team.penalty)}</td>
              <td className="px-2 py-1 text-right font-mono font-semibold">
                {totalTime != null ? secondsToMmSs(totalTime) : ''}
              </td>
            </tr>,
            ...team.members.map((m) => (
              <tr key={m.id} className="border-b border-gray-100">
                <td className="px-2 py-0.5"></td>
                <td className="px-2 py-0.5 pl-6 text-gray-700">
                  {m.participant.firstName} {m.participant.lastName}
                </td>
                <td className="px-2 py-0.5 text-gray-500">{m.participant.city}</td>
                <td colSpan={4}></td>
              </tr>
            )),
          ];
        })}
      </tbody>
    </table>
  );
}
