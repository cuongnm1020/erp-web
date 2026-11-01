'use client';

import type { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  TagsInput,
} from '@/components/data/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FARM_AREA_UNIT_LABEL, FARM_AREA_UNITS } from '@/lib/shared';
import { useOrderCropOptions } from '../../api/use-order-create';
import type { CreateOrderValues } from '../../schema';

/**
 * Thông tin khai thác của KHÁCH MỚI trên màn tạo đơn (2026-11-02) — 4 mục bắt buộc, gửi kèm khối
 * `customer` khi chốt đơn. Chỉ hiện khi SĐT chưa có khách nào.
 */
export function NewCustomerFarm({ form }: { form: UseFormReturn<CreateOrderValues> }) {
  const crops = useOrderCropOptions(true);
  return (
    <fieldset className="grid gap-2.5 rounded-md border px-3 pb-3 pt-2 sm:grid-cols-2">
      <legend className="px-1 text-xs font-semibold text-muted-foreground">
        Thông tin khai thác khách mới
      </legend>
      <div className="flex items-start gap-2">
        <FormField
          control={form.control}
          name="farmArea"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel required>Diện tích</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  inputMode="decimal"
                  placeholder="vd: 2,5"
                  className="text-right tabular-nums"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="farmAreaUnit"
          render={({ field }) => (
            <FormItem className="w-24">
              <FormLabel required>Đơn vị</FormLabel>
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger aria-label="Đơn vị diện tích">
                    <SelectValue placeholder="Chọn" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {FARM_AREA_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {FARM_AREA_UNIT_LABEL[u]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="treeAge"
        render={({ field }) => (
          <FormItem>
            <FormLabel required>Độ tuổi cây</FormLabel>
            <FormControl>
              <Input {...field} placeholder="vd: 3 năm, mới trồng" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="crops"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel required>Cây trồng</FormLabel>
            <FormControl>
              <TagsInput
                ref={field.ref}
                value={field.value}
                onChange={field.onChange}
                suggestions={crops.data?.items ?? []}
                placeholder="Gõ tên cây rồi Enter"
                aria-label="Cây trồng"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="diseaseHistory"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel required>Lịch sử bệnh</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                rows={2}
                placeholder="Bệnh từng gặp, đã xử lý thế nào — chưa từng bị thì ghi “Chưa từng”"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </fieldset>
  );
}
