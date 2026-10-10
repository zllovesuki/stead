import type { Env } from "./env";
import { handleRequest } from "./http/router";
export { PersonalAgent } from "./agents/personal-agent";
export { TaskAgent } from "./agents/task-agent";
export default { fetch: handleRequest } satisfies ExportedHandler<Env>;
