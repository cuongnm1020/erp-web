import { useWatch, type UseFormReturn } from 'react-hook-form';
import { orderCustomerPhone, type CreateOrderValues } from '../../schema';

/**
 * SĐT khách của đơn đang gõ (2026-11-14): ô Khách hàng, bỏ trống thì SĐT người nhận — để tra khách
 * đã có, cảnh báo đơn trùng trong ngày và thẻ Chăm sóc khách chạy cả khi chỉ nhập phần Nhận hàng.
 */
export function useOrderCustomerPhone(form: UseFormReturn<CreateOrderValues>): string {
  const [customerPhone, recipientPhone] = useWatch({
    control: form.control,
    name: ['customerPhone', 'recipientPhone'],
  });
  return orderCustomerPhone({ customerPhone, recipientPhone });
}
