import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** MSW cho Vitest (Node). Test gọi server.use(scenario.x) để đổi kịch bản. */
export const server = setupServer(...handlers);
