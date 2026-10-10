import { DurableObject } from "cloudflare:workers";

/** A fake provider's controlled pending I/O; never part of the product Worker. */
export class ModelGate extends DurableObject {
  private armed = false;
  private entered = false;
  private waiting = new Set<() => void>();

  arm() {
    this.armed = true;
    this.entered = false;
  }

  inspect() {
    return this.entered;
  }

  async wait() {
    if (!this.armed) return;
    this.entered = true;
    await new Promise<void>((resolve) => this.waiting.add(resolve));
  }

  release() {
    this.armed = false;
    for (const resolve of this.waiting) resolve();
    this.waiting.clear();
  }
}

const openGates = new Set<() => Promise<void>>();

export async function holdModel(
  namespace: DurableObjectNamespace<ModelGate>,
  marker: string,
) {
  const gate = () => namespace.getByName(marker);
  await gate().arm();
  const release = async () => {
    await gate().release();
    openGates.delete(release);
  };
  openGates.add(release);
  return {
    entered: () => gate().inspect(),
    release,
  };
}

export async function releaseModels() {
  await Promise.all([...openGates].map((release) => release()));
  openGates.clear();
}
