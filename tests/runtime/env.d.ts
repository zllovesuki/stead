import type { Env } from "../../apps/server/src/env";
import type { ModelGate } from "../fixtures/gate";

declare module "cloudflare:workers" {
  interface ProvidedEnv extends Env {
    MODEL_GATE: DurableObjectNamespace<ModelGate>;
  }
}

declare global {
  namespace Cloudflare {
    interface Env {
      MODEL_GATE: DurableObjectNamespace<ModelGate>;
    }
  }
}
