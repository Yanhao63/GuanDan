import { describe, expect, it } from 'vitest';
import type { CardData, Rank, Suit } from '../types';
import {
  beginTributeRound,
  chooseDoubleTribute,
  finishTributeReveal,
  getDoubleTributeLeader,
  getHighestTributeChoices,
  isDoubleTributeResisted,
  isSingleTributeResisted,
  isTributableCard,
  isValidReturnCard,
  submitReturnCard,
  submitTribute,
  type HandsBySeat,
} from './tribute';

let nextCardId = 2000;

function card(rank: Rank, suit: Suit = 'spades', deck: 1 | 2 = 1): CardData {
  nextCardId += 1;
  return { id: `tribute-${nextCardId}`, rank, suit, deck };
}

function hands(
  seat0: CardData[],
  seat1: CardData[],
  seat2: CardData[],
  seat3: CardData[],
): HandsBySeat {
  return { 0: seat0, 1: seat1, 2: seat2, 3: seat3 };
}

describe('tribute and return rules', () => {
  it('never allows a heart level card to be paid as tribute', () => {
    expect(isTributableCard(card('7', 'hearts'), '7')).toBe(false);
    expect(isTributableCard(card('7', 'spades'), '7')).toBe(true);
  });

  it('finds every physical card tied for the highest legal tribute', () => {
    const firstBigJoker = card('大王', 'joker', 1);
    const secondBigJoker = card('大王', 'joker', 2);
    const choices = getHighestTributeChoices([
      card('7', 'hearts'),
      card('A'),
      firstBigJoker,
      secondBigJoker,
    ], '7');

    expect(choices).toEqual([firstBigJoker, secondBigJoker]);
  });

  it('only accepts natural ranks from 2 through 10 as return cards', () => {
    expect(isValidReturnCard(card('2'))).toBe(true);
    expect(isValidReturnCard(card('10'))).toBe(true);
    expect(isValidReturnCard(card('J'))).toBe(false);
    expect(isValidReturnCard(card('大王', 'joker'))).toBe(false);
  });

  it('detects single and collective double anti-tribute', () => {
    const bigJokerOne = card('大王', 'joker', 1);
    const bigJokerTwo = card('大王', 'joker', 2);

    expect(isSingleTributeResisted([bigJokerOne, bigJokerTwo])).toBe(true);
    expect(isDoubleTributeResisted([[bigJokerOne], [bigJokerTwo]])).toBe(true);
    expect(isDoubleTributeResisted([[bigJokerOne], [card('小王', 'joker')]])).toBe(false);
  });

  it('lets the higher contributor lead, or the previous head player next seat on a tie', () => {
    expect(getDoubleTributeLeader(
      { card: card('A'), seat: 1 },
      { card: card('K'), seat: 3 },
      0,
      '7',
    )).toBe(1);

    expect(getDoubleTributeLeader(
      { card: card('A', 'spades', 1), seat: 1 },
      { card: card('A', 'clubs', 2), seat: 3 },
      2,
      '7',
    )).toBe(3);
  });

  it('completes single tribute, returns a low card, and lets the contributor lead', () => {
    const returned = card('6');
    const tribute = card('大王', 'joker');
    const initialHands = hands(
      [returned, card('Q')],
      [card('4')],
      [card('5')],
      [tribute, card('A')],
    );

    const started = beginTributeRound([0, 1, 2, 3], initialHands, '7');
    const paid = submitTribute(started, initialHands, 3, tribute.id);

    expect(paid.state).toMatchObject({
      mode: 'single',
      phase: 'revealing-tributes',
      recipientSeats: [0],
    });
    expect(paid.hands[0]).toContainEqual(tribute);
    expect(paid.hands[3]).not.toContainEqual(tribute);

    const revealed = finishTributeReveal(paid.state);
    const completed = submitReturnCard(revealed, paid.hands, 0, returned.id);

    expect(completed.state).toMatchObject({ phase: 'complete', leader: 3 });
    expect(completed.hands[3]).toContainEqual(returned);
    expect(completed.hands[0]).not.toContainEqual(returned);
  });

  it('lets the head player allocate double tribute and returns to each original source', () => {
    const tributeFromSeat1 = card('A');
    const tributeFromSeat3 = card('K');
    const returnFromHead = card('3');
    const returnFromTeammate = card('8');
    const initialHands = hands(
      [returnFromHead],
      [tributeFromSeat1, card('Q')],
      [returnFromTeammate],
      [tributeFromSeat3, card('J')],
    );

    const started = beginTributeRound([0, 2], initialHands, '7');
    const firstPaid = submitTribute(started, initialHands, 1, tributeFromSeat1.id);
    const bothPaid = submitTribute(firstPaid.state, firstPaid.hands, 3, tributeFromSeat3.id);

    expect(bothPaid.state.phase).toBe('revealing-tributes');
    const revealed = finishTributeReveal(bothPaid.state);

    const allocated = chooseDoubleTribute(
      revealed,
      bothPaid.hands,
      0,
      tributeFromSeat3.id,
    );

    expect(allocated.hands[0]).toContainEqual(tributeFromSeat3);
    expect(allocated.hands[2]).toContainEqual(tributeFromSeat1);

    const headReturned = submitReturnCard(
      allocated.state,
      allocated.hands,
      0,
      returnFromHead.id,
    );
    const completed = submitReturnCard(
      headReturned.state,
      headReturned.hands,
      2,
      returnFromTeammate.id,
    );

    expect(completed.state).toMatchObject({ phase: 'complete', leader: 1 });
    expect(completed.hands[3]).toContainEqual(returnFromHead);
    expect(completed.hands[1]).toContainEqual(returnFromTeammate);
  });

  it('reveals anti-tribute before skipping card exchanges and lets the previous head lead', () => {
    const firstBigJoker = card('大王', 'joker', 1);
    const secondBigJoker = card('大王', 'joker', 2);
    const initialHands = hands(
      [card('3')],
      [firstBigJoker],
      [card('4')],
      [secondBigJoker],
    );

    const resisted = beginTributeRound([0, 2], initialHands, '7');

    expect(resisted).toMatchObject({
      mode: 'double',
      phase: 'revealing-resistance',
      resisted: true,
      leader: 0,
    });
    expect(finishTributeReveal(resisted)).toMatchObject({
      phase: 'complete',
      resisted: true,
      leader: 0,
    });
  });

  it('rejects non-highest tribute and invalid return cards', () => {
    const lowTribute = card('K');
    const highestTribute = card('A');
    const invalidReturn = card('J');
    const initialHands = hands(
      [invalidReturn],
      [card('3')],
      [card('4')],
      [lowTribute, highestTribute],
    );
    const started = beginTributeRound([0, 1, 2, 3], initialHands, '7');

    expect(() => submitTribute(started, initialHands, 3, lowTribute.id)).toThrow(/最高/);

    const paid = submitTribute(started, initialHands, 3, highestTribute.id);
    const revealed = finishTributeReveal(paid.state);
    expect(() => submitReturnCard(revealed, paid.hands, 0, invalidReturn.id)).toThrow(/2 至 10/);
  });
});
