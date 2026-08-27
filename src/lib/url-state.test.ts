import { describe, expect, it } from 'vitest';
import { parseListState, serializeListState, toSkipTake } from './url-state';

const defaults = {
  size: 50,
  sort: { id: 'name', desc: false },
  filterKeys: ['owner', 'status'] as const,
};

describe('url-state', () => {
  it('URL rỗng → mặc định', () => {
    const s = parseListState(new URLSearchParams(''), defaults);
    expect(s).toEqual({ page: 1, size: 50, sort: { id: 'name', desc: false }, q: '', filters: {} });
    expect(toSkipTake(s)).toEqual({ skip: 0, take: 50 });
  });

  it('parse đầy đủ page/size/sort/q/filter; bỏ qua key lạ', () => {
    const s = parseListState(
      new URLSearchParams(
        'page=3&size=20&sort=createdAt:desc&q=%20abc%20&owner=u1&status=ACTIVE&hack=1',
      ),
      defaults,
    );
    expect(s).toEqual({
      page: 3,
      size: 20,
      sort: { id: 'createdAt', desc: true },
      q: 'abc',
      filters: { owner: 'u1', status: 'ACTIVE' },
    });
    expect(toSkipTake(s)).toEqual({ skip: 40, take: 20 });
  });

  it('giá trị rác → kẹp về biên (không cho size=100000, page=-1)', () => {
    const s = parseListState(new URLSearchParams('page=-1&size=100000&sort=:desc'), defaults);
    expect(s.page).toBe(1);
    expect(s.size).toBe(200);
    expect(s.sort).toBeNull();
    expect(parseListState(new URLSearchParams('page=abc'), defaults).page).toBe(1);
  });

  it('round-trip: serialize(parse(url)) ≡ url (F5 / dán link ra cùng request)', () => {
    const url = 'owner=u1&page=2&size=20&sort=createdAt:desc&q=abc';
    const once = serializeListState(parseListState(new URLSearchParams(url), defaults), defaults);
    const twice = serializeListState(parseListState(once, defaults), defaults);
    expect(twice.toString()).toBe(once.toString());
    expect(toSkipTake(parseListState(once, defaults))).toEqual({ skip: 20, take: 20 });
  });

  it('chỉ ghi khác mặc định → URL sạch; tắt sort mặc định ghi sort=none', () => {
    expect(
      serializeListState(
        { page: 1, size: 50, sort: { id: 'name', desc: false }, q: '', filters: {} },
        defaults,
      ).toString(),
    ).toBe('');
    expect(
      serializeListState(
        { page: 1, size: 50, sort: null, q: '', filters: {} },
        defaults,
      ).toString(),
    ).toBe('sort=none');
    expect(parseListState(new URLSearchParams('sort=none'), defaults).sort).toBeNull();
  });
});
