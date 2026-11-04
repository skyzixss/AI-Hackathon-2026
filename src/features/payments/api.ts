import type { PortalClient } from "../../lib/supabase.ts";
import type { TuitionCharge } from "./model.ts";

// Same authenticated client as the portal; ownership and amounts are set by the server.
export function createTuitionApi(client: PortalClient) {
  return {
    async charges(): Promise<TuitionCharge[]> {
      const { data } = await client.from("tuition_charges").select("*").order("due_on")
        .returns<TuitionCharge[]>().throwOnError();
      return data ?? [];
    },
    async payDemo(chargeId: string): Promise<TuitionCharge> {
      if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(chargeId)) throw new Error("Invalid invoice");
      const { data } = await client.rpc("complete_demo_tuition_payment", { charge_id: chargeId })
        .single<TuitionCharge>().throwOnError();
      if (!data?.paid_at || !data.demo_only || data.id !== chargeId) throw new Error("Payment not confirmed");
      return data;
    },
  };
}
export type TuitionApi = ReturnType<typeof createTuitionApi>;
