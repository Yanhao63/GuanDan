import type { CardData } from './types';

export function applyHandOrder(cards: CardData[], order: string[]): CardData[] {
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const ordered = order.flatMap((id) => {
    const card = cardsById.get(id);
    if (card === undefined) {
      return [];
    }
    cardsById.delete(id);
    return [card];
  });
  return [...ordered, ...cards.filter((card) => cardsById.has(card.id))];
}

export type CardDropPlacement = 'before' | 'after';

export function moveCardAtTarget(
  order: string[],
  draggedId: string,
  targetId: string,
  placement: CardDropPlacement,
): string[] {
  if (draggedId === targetId || !order.includes(draggedId) || !order.includes(targetId)) {
    return order;
  }
  const next = order.filter((id) => id !== draggedId);
  const targetIndex = next.indexOf(targetId);
  next.splice(placement === 'after' ? targetIndex + 1 : targetIndex, 0, draggedId);
  return next;
}
