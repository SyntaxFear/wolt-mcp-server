import type { Coordinates } from "../api/endpoints/discovery.js";
import { fetchVenueDynamic, type VenueDynamic } from "../api/endpoints/venue.js";
import type { WoltHttp } from "../api/http.js";

const CONCURRENCY = 6;

export interface LiveInfo {
  status?: string;
  next_open?: string;
  delivery_fee?: string;
  order_minimum?: string;
}

export function toLiveInfo({ venue }: VenueDynamic): LiveInfo {
  const delivery =
    venue.header?.delivery_method_statuses.find((entry) => entry.delivery_method === "DELIVERY") ??
    venue.header?.delivery_method_statuses[0];
  const meta = (meaning: string): string | undefined =>
    delivery?.metadata.find((entry) => entry.meaning === meaning)?.value ?? undefined;
  const status = venue.delivery_open_status;
  return {
    ...(status?.value && { status: status.value }),
    ...(status?.next_open && { next_open: status.next_open }),
    ...(meta("DELIVERY_FEE") && { delivery_fee: meta("DELIVERY_FEE") }),
    ...(meta("ORDER_MINIMUM") && { order_minimum: meta("ORDER_MINIMUM") }),
  };
}

/** Live details for several venues. A venue whose call fails simply gets none. */
export async function liveInfoFor(http: WoltHttp, slugs: string[], at: Coordinates): Promise<Map<string, LiveInfo>> {
  const found = new Map<string, LiveInfo>();
  const queue = [...slugs];
  const worker = async (): Promise<void> => {
    for (let slug = queue.shift(); slug !== undefined; slug = queue.shift()) {
      const page = await fetchVenueDynamic(http, slug, at).catch(() => undefined);
      if (page) found.set(slug, toLiveInfo(page));
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  return found;
}
