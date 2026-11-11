// PROTOTYPE — throwaway full-page feed for variant C (issue #10).
import { useRouteLoaderData } from "react-router";
import { VariantCPage } from "~/components/notifications-prototype";
import type { loader as layoutLoader } from "./layout.app";

export default function PrototypeNotifications() {
  const data = useRouteLoaderData<typeof layoutLoader>("routes/layout.app");
  return <VariantCPage role={data?.currentUser?.role ?? null} />;
}
