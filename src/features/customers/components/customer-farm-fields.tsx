'use client';

import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
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
import { useCropOptions } from '../api/use-customers';

/** Tên 5 trường khai thác trong form (giống nhau ở form khách). */
export interface FarmFieldNames<T extends FieldValues> {
  farmArea: FieldPath<T>;
  farmAreaUnit: FieldPath<T>;
  crops: FieldPath<T>;
  treeAge: FieldPath<T>;
  diseaseHistory: FieldPath<T>;
}

/**
 * Thông tin khai thác khách (2026-11-02): Diện tích (+ đơn vị), Cây trồng (chọn nhiều, gõ tự do có
 * gợi ý), Độ tuổi cây, Lịch sử bệnh — cả 4 bắt buộc. Đặt trong lưới 2 cột của `Section`.
 */
export function CustomerFarmFields<T extends FieldValues>({
  control,
  names,
}: {
  control: Control<T>;
  names: FarmFieldNames<T>;
}) {
  const crops = useCropOptions();
  return (
    <>
      <div className="flex items-start gap-2">
        <FormField
          control={control}
          name={names.farmArea}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel required>Diện tích</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={(field.value as string) ?? ''}
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
          control={control}
          name={names.farmAreaUnit}
          render={({ field }) => (
            <FormItem className="w-28">
              <FormLabel required>Đơn vị</FormLabel>
              <Select value={(field.value as string) || undefined} onValueChange={field.onChange}>
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
        control={control}
        name={names.crops}
        render={({ field }) => (
          <FormItem>
            <FormLabel required>Cây trồng</FormLabel>
            <FormControl>
              <TagsInput
                ref={field.ref}
                value={(field.value as string[]) ?? []}
                onChange={field.onChange}
                suggestions={crops.data?.items ?? []}
                placeholder="Gõ tên cây rồi Enter"
                aria-label="Cây trồng"
              />
            </FormControl>
            <FormDescription>
              Chọn nhiều; cây chưa có trong gợi ý thì gõ tên rồi Enter
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={names.treeAge}
        render={({ field }) => (
          <FormItem>
            <FormLabel required>Độ tuổi cây</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={(field.value as string) ?? ''}
                placeholder="vd: 3 năm, mới trồng"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={names.diseaseHistory}
        render={({ field }) => (
          <FormItem className="col-span-2">
            <FormLabel required>Lịch sử bệnh</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                value={(field.value as string) ?? ''}
                rows={3}
                placeholder="Bệnh từng gặp, thời điểm, đã xử lý thế nào — chưa từng bị thì ghi “Chưa từng”"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
