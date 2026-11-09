// Turns a report into plain sentences. Shared by the page and the API, so both say exactly the same thing.
import type { Report } from './epoch';

export const ACCOUNT_ID = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

const date = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;
const keysWord = (n: number) => (n === 1 ? 'key' : `${n} keys`);

export type Tone = 'neutral' | 'steady' | 'changed' | 'recent';
export type Explanation = { tone: Tone; headline: string; detail: string[]; since: number | null };

export function explain(r: Report): Explanation {
  const v = r.verdict;
  const a = r.account;
  switch (v.kind) {
    case 'missing':
      return { tone: 'neutral', headline: `There is no account called ${a} on NEAR mainnet.`, detail: ['Check the spelling, including the ending such as .near or .tg.'], since: null };
    case 'locked':
      return {
        tone: 'steady',
        headline: `Nobody holds a full-access key to ${a}.`,
        detail: [
          v.contract
            ? 'It runs a contract, so only that contract’s own code can change who controls it.'
            : 'Its keys can only call specific contract methods, so nobody can take it over by adding a key.',
        ],
        since: null,
      };
    case 'unchanged':
      if (!v.since)
        return {
          tone: 'steady',
          headline: `${a} is still controlled by a key from before June 2021.`,
          detail: ['At least one of its full-access keys predates the dates NEAR stamps on keys, and it has never been removed.'],
          since: null,
        };
      return {
        tone: 'steady',
        headline: `The same keys have controlled ${a} since ${date(v.since.time)}.`,
        detail: ['That is when it got its first full-access key, and no earlier controller had to be removed.'],
        since: v.since.time,
      };
    case 'changed': {
      const at = date(v.at.time);
      const detail = [];
      if (v.pattern === 'handover')
        detail.push(
          `The previous ${keysWord(v.previousKeys)} ${v.previousKeys === 1 ? 'was' : 'were'} removed on ${date(v.oldRemoved.time)}, and for ${days(v.keylessDays)} nobody held a full-access key. That is how an account changes hands through a marketplace contract.`,
        );
      else if (v.pattern === 'swap')
        detail.push(
          `The previous ${keysWord(v.previousKeys)} ${v.previousKeys === 1 ? 'was' : 'were'} removed at the same moment. Owners do this when they replace a lost or exposed key. Someone taking over an account does it too.`,
        );
      else
        detail.push(
          `The old and new keys worked side by side until ${date(v.oldRemoved.time)}. That usually means the owner moved to new keys themselves.`,
        );
      detail.push(`Activity before ${at} was signed by keys that no longer control this account.`);
      return {
        tone: v.recent ? 'recent' : 'changed',
        headline: v.recent ? `New keys took control of ${a} ${days(v.daysAgo)} ago, on ${at}.` : `New keys took control of ${a} on ${at}.`,
        detail,
        since: v.at.time,
      };
    }
  }
}
