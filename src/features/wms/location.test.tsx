import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { LocationScreen } from './components/location-screen';
import { RelocateScreen } from './components/relocate-screen';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/pda/location',
  useRouter: () => ({ push: nav.push, replace: nav.replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const LOC_A = {
  id: 'loc-a',
  code: 'A-01-2',
  barcode: 'LOC-A-01-2',
  type: 'BIN',
  label: 'Dãy A · Kệ 01 · Tầng 2',
  isPickable: false,
  isDefault: false,
  warehouseId: 'wh-1',
  warehouseCode: 'WH01',
};

const CONTENTS = {
  location: LOC_A,
  skuCount: 2,
  containerCount: 3,
  items: [
    {
      skuId: 'sku-X',
      skuCode: 'SP-0002',
      skuName: 'Phân bón lá',
      baseUomCode: 'GOI',
      lotId: null,
      lotNumber: null,
      onHand: '82.000000',
      reserved: '10.000000',
      inHand: '24.000000',
      movable: '58.000000',
      looseQty: '10.000000',
      containers: [
        {
          id: 'c-1',
          barcode: 'THG-1',
          typeCode: 'CARTON',
          typeName: 'Thùng',
          status: 'STORED',
          qty: '24.000000',
          parentBarcode: null,
        },
        {
          id: 'c-2',
          barcode: 'THG-2',
          typeCode: 'CARTON',
          typeName: 'Thùng',
          status: 'STORED',
          qty: '24.000000',
          parentBarcode: null,
        },
        {
          id: 'c-3',
          barcode: 'THG-3',
          typeCode: 'CARTON',
          typeName: 'Thùng',
          status: 'PICKED',
          qty: '24.000000',
          parentBarcode: null,
        },
      ],
    },
    {
      skuId: 'sku-Y',
      skuCode: 'SP-0003',
      skuName: 'Thuốc trừ sâu',
      baseUomCode: 'CHAI',
      lotId: 'lot-1',
      lotNumber: 'L2610',
      onHand: '6.000000',
      reserved: '0.000000',
      inHand: '0.000000',
      movable: '6.000000',
      looseQty: '6.000000',
      containers: [],
    },
  ],
};

const EMPTY_RESOLVE = {
  sku: null,
  container: null,
  order: null,
  task: null,
  wave: null,
  location: null,
  shipment: null,
};

type RelocateBody = {
  fromLocationId: string;
  toLocationId: string;
  all?: boolean;
  containerIds?: string[];
  loose?: { skuId: string; lotId: string | null; qty: string }[];
  idempotencyKey: string;
};

function useLocationServer() {
  const bodies: RelocateBody[] = [];
  server.use(
    http.get('/api/pda/locations/:id/contents', ({ params }) =>
      params.id === 'loc-a'
        ? HttpResponse.json(CONTENTS)
        : HttpResponse.json({
            ...CONTENTS,
            location: { ...LOC_A, id: 'loc-b', code: 'B-02-1' },
            items: [],
            skuCount: 0,
            containerCount: 0,
          }),
    ),
    http.get('/api/pda/resolve/:code', ({ params }) => {
      const code = String(params.code);
      const loc = (id: string, c: string) =>
        HttpResponse.json({
          ...EMPTY_RESOLVE,
          code,
          kind: 'location',
          location: {
            id,
            code: c,
            type: 'BIN',
            warehouseId: 'wh-1',
            warehouseCode: 'WH01',
            pickSequence: 1,
          },
        });
      if (code === 'LOC-B-02-1') return loc('loc-b', 'B-02-1');
      if (code === 'LOC-A-01-2') return loc('loc-a', 'A-01-2');
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'x' }, { status: 404 });
    }),
    http.post('/api/pda/relocate', async ({ request }) => {
      const body = (await request.json()) as RelocateBody;
      bodies.push(body);
      return HttpResponse.json({
        fromLocation: LOC_A,
        toLocation: { ...LOC_A, id: 'loc-b', code: 'B-02-1' },
        containersMoved: body.containerIds?.length ?? 0,
        qtyMoved: '50.000000',
        skippedPicked: [],
        pickLinesKept: 1,
        pickLinesRepointed: 2,
        pickLinesSplit: 1,
        shortages: [{ taskDocNumber: 'PICK2610-00011', skuId: 'sku-X', qty: '2.000000' }],
        replayed: false,
      });
    }),
  );
  return { bodies };
}

const scan = async (code: string) => {
  const input = screen.getByLabelText(/^Quét/);
  await waitFor(() => expect(input).toBeEnabled());
  fireEvent.change(input, { target: { value: code } });
  fireEvent.keyDown(input, { key: 'Enter' });
};

describe('Tra vị trí web (LOC-3)', () => {
  it('chưa có ?id → chờ quét; quét tem vị trí → đổi URL sang vị trí đó', async () => {
    nav.search = '';
    useLocationServer();
    renderApp(<LocationScreen />);
    expect(screen.getByText('Quét tem vị trí', { selector: 'p' })).toBeInTheDocument();
    await scan('LOC-A-01-2');
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/pda/location?id=loc-a'));
  });

  it('?id → nhãn vị trí, tầng dự trữ, SKU + tồn + giữ / đã lấy / rời, thùng đã quét lấy; có nút chuyển', async () => {
    nav.search = 'id=loc-a';
    useLocationServer();
    renderApp(<LocationScreen />);
    const loc = await screen.findByRole('region', { name: 'Vị trí' });
    expect(loc).toHaveTextContent('Dãy A · Kệ 01 · Tầng 2');
    expect(loc).toHaveTextContent('Tầng dự trữ');
    expect(loc).toHaveTextContent('2 mã hàng · 3 thùng');
    const list = screen.getByRole('list', { name: 'Hàng ở vị trí' });
    expect(list).toHaveTextContent('Phân bón lá');
    expect(list).toHaveTextContent('giữ cho đơn 10 · đã quét lấy 24 · rời 10');
    expect(list).toHaveTextContent('THG-3 · đã quét lấy');
    expect(list).toHaveTextContent('lô L2610');
    expect(screen.getByRole('link', { name: /Chuyển hàng ở đây/ })).toHaveAttribute(
      'href',
      '/pda/relocate?from=loc-a',
    );
  });

  it('không có stock.transfer → không có nút chuyển; không có task.execute → không có quyền', async () => {
    nav.search = 'id=loc-a';
    useLocationServer();
    const { unmount } = renderApp(<LocationScreen />, {
      me: { ...ME_SALE, permissions: ['task.execute'] },
    });
    await screen.findByRole('region', { name: 'Vị trí' });
    expect(screen.queryByRole('link', { name: /Chuyển hàng ở đây/ })).toBeNull();
    unmount();
    renderApp(<LocationScreen />, { me: { ...ME_SALE, permissions: ['stock.read'] } });
    expect(screen.getByRole('alert')).toHaveTextContent(/không có quyền/i);
  });
});

describe('Chuyển hàng web (LOC-8)', () => {
  it('quét thùng + gõ hàng rời → quét vị trí đích → chuyển; kết quả trỏ lại / tách / sự cố', async () => {
    nav.search = 'from=loc-a';
    const { bodies } = useLocationServer();
    renderApp(<RelocateScreen />);
    await screen.findByRole('list', { name: 'Hàng chuyển được' });

    await scan('THG-1');
    expect(await screen.findByRole('checkbox', { name: 'Chọn thùng THG-1' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Chọn thùng THG-3' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Hàng rời SP-0003 chuyển' }), {
      target: { value: '4' },
    });
    expect(screen.getByRole('region', { name: 'Đã chọn' })).toHaveTextContent(
      'Đã chọn 1 thùng · 28',
    );

    await scan('LOC-B-02-1');
    expect(await screen.findByRole('region', { name: 'Vị trí đích' })).toHaveTextContent('B-02-1');
    fireEvent.click(screen.getByRole('button', { name: /Chuyển sang B-02-1/ }));

    expect(await screen.findByText('Đã chuyển A-01-2 → B-02-1')).toBeInTheDocument();
    expect(bodies[0]).toMatchObject({
      fromLocationId: 'loc-a',
      toLocationId: 'loc-b',
      containerIds: ['c-1'],
      loose: [{ skuId: 'sku-Y', lotId: 'lot-1', qty: '4.000000' }],
    });
    expect(
      screen.getByText('2 dòng lấy hàng chuyển sang vị trí mới (1 dòng tách)'),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 đơn thiếu hàng → Sự cố: PICK2610-00011/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem vị trí B-02-1' })).toHaveAttribute(
      'href',
      '/pda/location?id=loc-b',
    );
  });

  it('hàng rời vượt phần chuyển được → nút khoá; quét thùng đã lấy → báo; quét chính vị trí nguồn → báo', async () => {
    nav.search = 'from=loc-a';
    const { bodies } = useLocationServer();
    renderApp(<RelocateScreen />);
    await screen.findByRole('list', { name: 'Hàng chuyển được' });

    await scan('THG-3');
    expect(await screen.findByText('Thùng THG-3 đã được quét lấy cho đơn')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Hàng rời SP-0003 chuyển' }), {
      target: { value: '7' },
    });
    expect(screen.getByRole('button', { name: /Số lượng hàng rời không hợp lệ/ })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Hàng rời SP-0003 chuyển' }), {
      target: { value: '6' },
    });
    await scan('LOC-A-01-2');
    expect(await screen.findByText('Đây là vị trí đang chuyển đi')).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  it('"Chọn tất cả" → xác nhận → gửi all: true', async () => {
    nav.search = 'from=loc-a';
    const { bodies } = useLocationServer();
    renderApp(<RelocateScreen />);
    await screen.findByRole('list', { name: 'Hàng chuyển được' });
    fireEvent.click(screen.getByRole('button', { name: 'Chọn tất cả' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Chọn tất cả' }),
    );
    await scan('LOC-B-02-1');
    fireEvent.click(await screen.findByRole('button', { name: /Chuyển sang B-02-1/ }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ fromLocationId: 'loc-a', toLocationId: 'loc-b', all: true });
    expect(bodies[0]!.containerIds).toBeUndefined();
  });

  it('thiếu stock.transfer → không có quyền', () => {
    nav.search = 'from=loc-a';
    renderApp(<RelocateScreen />, { me: { ...ME_SALE, permissions: ['task.execute'] } });
    expect(screen.getByRole('alert')).toHaveTextContent(/không có quyền/i);
  });
});
