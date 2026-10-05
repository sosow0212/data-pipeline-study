import { Suspense } from "react";
import { LogExplorer } from "@/features/logs/components/log-explorer";
export default function Page() {
  return (
    <Suspense>
      <LogExplorer />
    </Suspense>
  );
}
