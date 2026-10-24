import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ME_SALE } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { PutAwayScreen } from './components/put-away-screen';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/pda/put-away',
  useRouter: () => ({ push: nav.push, replace: nav.replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const TASK_ID = '00000000-0000-4000-8000-00000000e101';

const unit = (n: number) => ({
  id: `c-${n}`,
  barcode: `THG-${n}`,
  qty: '24.000000',
  childCount: 0,
  parentBarcode: null,
});

const LOC_REF = (code: string, id: string) => ({
  id,
  code,
  barcode: `LOC-${code}`,
  type: 'BIN',
  label: code,
  isPickable: true,
  isDefault: code === 'DEFAULT',
  warehouseId: 'wh-1',
  warehouseCode: 'WH01',
});

const VIEW = {
  taskId: TASK_ID,
  docNumber: 'PUT2610-00007',
  status: 'ASSIGNED',
  assignedToMe: true,
  receiptDocNumber: 'GRN2610-00004',
  fromLocationCode: 'DOCK',
  defaultLocation: LOC_REF('DEFAULT', 'loc-def'),
  groups: [
    {
      key: 'g-x',
      skuId: 'sku-X',
      skuCode: 'SP-0002',
      skuName: 'Phân bón lá',
      baseUomCode: 'GOI',
      lotId: null,
      lotNumber: null,
      containerTypeCode: 'CARTON',
      containerTypeName: 'Thùng',
      remainingCount: 3,
      remainingQty: '72.000000',
      placedCount: 0,
      placedQty: '0.000000',
      suggestedLocationCode: 'A01-01',
      containers: [unit(1), unit(2), unit(3)],
    },
    {
      key: 'g-y',
      skuId: 'sku-Y',
      skuCode: 'SP-0003',
      skuName: 'Thuốc trừ sâu',
      baseUomCode: 'CHAI',
      lotId: null,
      lotNumber: null,
      containerTypeCode: null,
      containerTypeName: null,
      remainingCount: 0,
      remainingQty: '5.000000',
      placedCount: 0,
      placedQty: '0.000000',
      suggestedLocationCode: null,
      containers: [],
    },
  ],
  placed: [],
  remainingCount: 4,
};

const QUEUE = {
  type: 'PUT_AWAY',
  warehouseId: null,
  items: [
    {
      taskId: TASK_ID,
      docNumber: 'PUT2610-00007',
      status: 'PENDING',
      assignedToMe: false,
      refDocNumber: null,
      lineCount: 2,
      createdAt: new Date(Date.UTC(2026, 9, 24)).toISOString(),
      ageMinutes: 5,
    },
  ],
  waiting: 1,
  mine: 0,
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

const resolveLocation = (code: string, id: string) => ({
  ...EMPTY_RESOLVE,
  code: `LOC-${code}`,
  kind: 'location',
  location: { id, code, type: 'BIN', warehouseId: 'wh-1', warehouseCode: 'WH01', pickSequence: 1 },
});

type AssignBody = {
  toLocationId?: string;
  toDefault?: boolean;
  allRemaining?: boolean;
  containerIds?: string[];
  loose?: { skuId: string; lotId: string | null; qty: string }[];
  idempotencyKey: string;
};

/** Server giả: ghi lại thân assign; `failOnce` = lần đầu rớt mạng. */
function usePutAwayServer(opts: { failOnce?: boolean } = {}) {
  const bodies: AssignBody[] = [];
  let failed = false;
  server.use(
    http.get('/api/pda/queue', () => HttpResponse.json(QUEUE)),
    http.post('/api/pda/tasks/:id/claim', () => HttpResponse.json({ taskId: TASK_ID })),
    http.get('/api/pda/putaway/:id', () => HttpResponse.json(VIEW)),
    http.get('/api/pda/resolve/:code', ({ params }) => {
      const code = String(params.code);
      if (code === 'LOC-A01-05') return HttpResponse.json(resolveLocation('A01-05', 'loc-5'));
      if (code === 'PUT2610-00007')
        return HttpResponse.json({
          ...EMPTY_RESOLVE,
          code,
          kind: 'task',
          task: { id: TASK_ID, docNumber: code, type: 'PUT_AWAY', status: 'PENDING' },
        });
      if (code === 'BC-Y')
        return HttpResponse.json({
          ...EMPTY_RESOLVE,
          code,
          kind: 'sku',
          sku: {
            barcode: code,
            type: 'EAN13',
            sku: { id: 'sku-Y', code: 'SP-0003', name: 'Thuốc trừ sâu' },
            uom: { id: 'u', code: 'CHAI', name: 'Chai' },
            baseUom: { id: 'u', code: 'CHAI', name: 'Chai' },
            factor: '1',
          },
        });
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'x' }, { status: 404 });
    }),
    http.post('/api/pda/putaway/:id/assign', async ({ request }) => {
      if (opts.failOnce && !failed) {
        failed = true;
        return HttpResponse.error();
      }
      const body = (await request.json()) as AssignBody;
      bodies.push(body);
      const toDefault = body.toDefault === true;
      const to = toDefault ? LOC_REF('DEFAULT', 'loc-def') : LOC_REF('A01-05', 'loc-5');
      const n = body.containerIds?.length ?? 0;
      return HttpResponse.json({
        toLocation: to,
        containersPlaced: toDefault ? 3 : n,
        looseQtyPlaced: body.loose?.[0]?.qty ?? '0.000000',
        taskCompleted: toDefault,
        replayed: false,
        view: {
          ...VIEW,
          status: toDefault ? 'COMPLETED' : 'IN_PROGRESS',
          groups: VIEW.groups.map((g) =>
            g.key === 'g-x'
              ? {
                  ...g,
                  containers: toDefault
                    ? []
                    : g.containers.filter((c) => !body.containerIds?.includes(c.id)),
                  remainingCount: toDefault ? 0 : 3 - n,
                }
              : g,
          ),
          placed: [
            {
              locationId: to.id,
              locationCode: to.code,
              locationLabel: to.label,
              containerCount: toDefault ? 3 : n,
              qty: '48.000000',
            },
          ],
          remainingCount: toDefault ? 0 : 4 - n,
        },
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

const openFromQueue = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Mở PUT2610-00007' }));
  await screen.findByRole('region', { name: 'Chưa cất' });
};

describe('Màn cất hàng web (LOC-6) — giỏ thùng → quét vị trí → cất', () => {
  it('quét 1 thùng + gõ số thùng → giỏ; quét vị trí → "Cất vào" gửi thùng vừa quét trước', async () => {
    nav.search = '';
    const { bodies } = usePutAwayServer();
    renderApp(<PutAwayScreen />);
    await openFromQueue();

    await scan('THG-2');
    const pad = await screen.findByRole('textbox', { name: 'Số thùng' });
    expect(screen.getByRole('region', { name: 'Số lượng cho vào giỏ' })).toHaveTextContent(
      'còn 3, thùng THG-2 trước',
    );
    fireEvent.change(pad, { target: { value: '2' } });
    fireEvent.keyDown(pad, { key: 'Enter' });
    expect(screen.getByRole('region', { name: 'Giỏ' })).toHaveTextContent('2 thùng');

    await scan('LOC-A01-05');
    expect(await screen.findByRole('region', { name: 'Vị trí cất' })).toHaveTextContent('A01-05');
    fireEvent.click(screen.getByRole('button', { name: /Cất vào A01-05/ }));

    expect(await screen.findByText('Đã cất 2 thùng vào A01-05')).toBeInTheDocument();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ toLocationId: 'loc-5', containerIds: ['c-2', 'c-1'] });
    expect(bodies[0]!.idempotencyKey).toMatch(/.{8,}/);
    expect(screen.getByRole('region', { name: 'Đã cất' })).toHaveTextContent('A01-05');
    expect(screen.getByRole('region', { name: 'Giỏ' })).toHaveTextContent('Trống');
  });

  it('số thùng vượt số còn → nút khoá; hàng rời quét mã SP + gõ số lượng → gửi loose', async () => {
    nav.search = '';
    const { bodies } = usePutAwayServer();
    renderApp(<PutAwayScreen />);
    await openFromQueue();

    await scan('THG-1');
    const pad = await screen.findByRole('textbox', { name: 'Số thùng' });
    fireEvent.change(pad, { target: { value: '9' } });
    expect(screen.getByRole('button', { name: 'Số lượng không hợp lệ' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));

    await scan('BC-Y');
    const loose = await screen.findByRole('textbox', { name: 'Số lượng hàng rời' });
    fireEvent.change(loose, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cho 3 CHAI vào giỏ' }));
    await scan('LOC-A01-05');
    fireEvent.click(await screen.findByRole('button', { name: /Cất vào A01-05/ }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      toLocationId: 'loc-5',
      loose: [{ skuId: 'sku-Y', lotId: null, qty: '3.000000' }],
    });
    expect(bodies[0]!.containerIds).toBeUndefined();
  });

  it('quét vị trí khi giỏ trống → nhắc quét thùng trước, không gửi', async () => {
    nav.search = '';
    const { bodies } = usePutAwayServer();
    renderApp(<PutAwayScreen />);
    await openFromQueue();
    await scan('LOC-A01-05');
    expect(await screen.findByText(/Giỏ trống — chưa có gì để cất vào A01-05/)).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  it('"Cất còn lại vào DEFAULT" → xác nhận → toDefault + allRemaining → xong việc', async () => {
    nav.search = '';
    const { bodies } = usePutAwayServer();
    renderApp(<PutAwayScreen />);
    await openFromQueue();
    fireEvent.click(screen.getByRole('button', { name: 'Cất còn lại vào DEFAULT' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cất vào DEFAULT' }));

    expect(await screen.findByText('Xong PUT2610-00007')).toBeInTheDocument();
    expect(bodies[0]).toMatchObject({ toDefault: true, allRemaining: true });
    expect(screen.getByRole('button', { name: 'Việc cất tiếp theo' })).toBeInTheDocument();
  });

  it('rớt mạng lúc cất → "Gửi lại" dùng đúng key cũ', async () => {
    nav.search = '';
    const { bodies } = usePutAwayServer({ failOnce: true });
    renderApp(<PutAwayScreen />);
    await openFromQueue();
    await scan('THG-3');
    const pad = await screen.findByRole('textbox', { name: 'Số thùng' });
    fireEvent.keyDown(pad, { key: 'Enter' });
    await scan('LOC-A01-05');
    fireEvent.click(await screen.findByRole('button', { name: /Cất vào A01-05/ }));

    const resend = await screen.findByRole('button', { name: /Gửi lại · cất vào A01-05/ });
    expect(screen.getByText('Mất mạng — chưa chắc đã cất')).toBeInTheDocument();
    fireEvent.click(resend);
    expect(await screen.findByText('Đã cất 1 thùng vào A01-05')).toBeInTheDocument();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]!.containerIds).toEqual(['c-3']);
  });

  it('quét mã việc PUT ở màn chờ → nhận việc; ?task=<id> → tự nhận, bỏ param', async () => {
    nav.search = '';
    usePutAwayServer();
    const { unmount } = renderApp(<PutAwayScreen />);
    await scan('PUT2610-00007');
    expect(
      await screen.findByText('Đã nhận PUT2610-00007. Quét thùng để cho vào giỏ.'),
    ).toBeInTheDocument();
    unmount();

    nav.search = `task=${TASK_ID}`;
    renderApp(<PutAwayScreen />);
    await screen.findByRole('region', { name: 'Chưa cất' });
    expect(nav.replace).toHaveBeenCalledWith('/pda/put-away');
    nav.search = '';
  });

  it('không có task.execute → màn không có quyền', () => {
    nav.search = '';
    renderApp(<PutAwayScreen />, { me: { ...ME_SALE, permissions: ['stock.read'] } });
    expect(screen.getByRole('alert')).toHaveTextContent(/không có quyền/i);
  });
});
