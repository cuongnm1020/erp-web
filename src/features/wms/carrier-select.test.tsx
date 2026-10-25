import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { CARRIERS } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';
import { carrierAccountOptions, findCarrierOption, type Carrier } from './api/use-shipping';
import { CarrierSelect } from './components/carrier-select';

/** GHTK hai tài khoản như prod (mã shop + tên), một tài khoản chưa cấu hình. */
const WITH_ACCOUNTS = CARRIERS.map((c) =>
  c.code === 'GHTK'
    ? {
        ...c,
        accounts: [
          {
            id: 'acc-hl',
            name: 'Nam Việt - Hàng Lòng',
            code: 'S23119447',
            isDefault: true,
            configured: true,
          },
          { id: 'acc-cn', name: 'Cá Nhân', code: 'S23166145', isDefault: false, configured: true },
          { id: 'acc-x', name: 'Shop chưa xong', code: null, isDefault: false, configured: false },
        ],
      }
    : c,
) as Carrier[];

describe('carrierAccountOptions — nhãn dùng chung mọi ô chọn hãng (2026-10-25)', () => {
  it('không dòng cấp hãng: mỗi tài khoản đủ cấu hình "<MÃ HÃNG> <mã TK> <tên>", mặc định trước; "Mặc định" chưa đặt tên → tên hãng; hãng không tài khoản → tên hãng', () => {
    expect(carrierAccountOptions(WITH_ACCOUNTS).map((o) => o.label)).toEqual([
      'Giao thủ công (xe nhà / khách tự lấy)',
      'GHTK S23119447 Nam Việt - Hàng Lòng',
      'GHTK S23166145 Cá Nhân',
      'VTP Viettel Post',
    ]);
  });

  it('tên đã chứa mã thì không lặp mã', () => {
    const named = WITH_ACCOUNTS.map((c) =>
      c.code === 'VTP'
        ? { ...c, accounts: [{ ...c.accounts[0]!, name: 'T0196 Kho Long An', code: 'T0196' }] }
        : c,
    );
    expect(carrierAccountOptions(named).at(-1)?.label).toBe('VTP T0196 Kho Long An');
  });

  it('findCarrierOption: tài khoản null = dòng tài khoản mặc định của hãng', () => {
    const options = carrierAccountOptions(WITH_ACCOUNTS);
    expect(findCarrierOption(options, 'c-ghtk', null)?.accountId).toBe('acc-hl');
    expect(findCarrierOption(options, 'c-ghtk', 'acc-cn')?.accountId).toBe('acc-cn');
    expect(findCarrierOption(options, 'c-ghtk', 'acc-x')).toBeUndefined();
  });
});

describe('CarrierSelect', () => {
  it('chọn tài khoản mặc định trả accountId null, tài khoản khác trả id; giá trị đã lưu của hãng đã tắt vẫn hiện', async () => {
    server.use(http.get('/api/carriers', () => HttpResponse.json(WITH_ACCOUNTS)));
    const onChange = vi.fn();
    const { rerender } = renderApp(
      <CarrierSelect value={{ carrierId: 'c-old', accountId: null }} onChange={onChange} />,
    );
    const box = screen.getByRole('combobox', { name: 'Hãng vận chuyển' });
    await waitFor(() => expect(box).toHaveTextContent('Hãng đã tắt — đã tắt'));

    rerender(<CarrierSelect value={null} onChange={onChange} />);
    fireEvent.click(box);
    expect(screen.queryByRole('option', { name: /Shop chưa xong|GHN/ })).not.toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole('option', { name: 'GHTK S23119447 Nam Việt - Hàng Lòng' }),
    );
    expect(onChange).toHaveBeenLastCalledWith(
      { carrierId: 'c-ghtk', accountId: null },
      expect.objectContaining({ accountId: 'acc-hl' }),
    );
    fireEvent.click(box);
    fireEvent.click(await screen.findByRole('option', { name: 'GHTK S23166145 Cá Nhân' }));
    expect(onChange).toHaveBeenLastCalledWith(
      { carrierId: 'c-ghtk', accountId: 'acc-cn' },
      expect.objectContaining({ accountId: 'acc-cn' }),
    );
  });
});
