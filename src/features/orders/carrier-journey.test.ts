import { describe, expect, it } from 'vitest';
import { STATUS_LOG_FIXTURE } from '@/test/msw/handlers';
import { groupJourney, type JourneyStage } from './components/carrier-journey';

const row = (id: string, journeyStage: JourneyStage) =>
  ({ ...STATUS_LOG_FIXTURE.items[0]!, id, journeyStage }) as Parameters<
    typeof groupJourney
  >[0][number];

describe('groupJourney — mục theo giai đoạn như app hãng', () => {
  it('dòng liền nhau cùng giai đoạn gộp một mục, giữ thứ tự mới nhất trước', () => {
    const g = groupJourney([row('a', 'IN_TRANSIT'), row('b', 'IN_TRANSIT'), row('c', 'PICKED_UP')]);
    expect(g.map((x) => [x.stage, x.events.map((e) => e.id)])).toEqual([
      ['IN_TRANSIT', ['a', 'b']],
      ['PICKED_UP', ['c']],
    ]);
  });

  it('giao → tồn → giao lại: giai đoạn lặp lại sau giai đoạn khác là mục riêng', () => {
    const g = groupJourney([
      row('d2', 'DELIVERING'),
      row('f', 'DELIVERY_FAILED'),
      row('d1', 'DELIVERING'),
    ]);
    expect(g.map((x) => x.stage)).toEqual(['DELIVERING', 'DELIVERY_FAILED', 'DELIVERING']);
  });

  it('không có dòng → không có mục', () => {
    expect(groupJourney([])).toEqual([]);
  });
});
