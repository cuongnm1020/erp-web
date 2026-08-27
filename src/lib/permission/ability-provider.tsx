'use client';

import {
  AbilityProvider as CaslProvider,
  Can as CaslCan,
  useAbility as useCaslAbility,
  type CanProps,
} from '@casl/react';
import { useMemo, type ReactNode } from 'react';
import { buildAbility, EMPTY_ABILITY, type AppAbility, type AuthMe } from './ability';

/**
 * Nhận `me` từ ngoài (features/auth gọi useMe rồi truyền vào) để lib/ không phụ thuộc features/.
 * Ability build một lần cho mỗi `me` (luật 7).
 */
export function AbilityProvider({
  me,
  children,
}: {
  me: Pick<AuthMe, 'permissions' | 'hasGlobalAccess'> | null | undefined;
  children: ReactNode;
}) {
  const ability = useMemo(() => (me ? buildAbility(me) : EMPTY_ABILITY), [me]);
  return <CaslProvider value={ability}>{children}</CaslProvider>;
}

export function useAbility(): AppAbility {
  return useCaslAbility<AppAbility>();
}

/** <Can I="create" a="Customer">…</Can> — ẩn UI theo quyền, KHÔNG phải bảo mật. */
export function Can(props: CanProps<AppAbility>) {
  return <CaslCan<AppAbility> {...props} />;
}
