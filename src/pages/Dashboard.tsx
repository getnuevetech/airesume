import { Navigate, useSearchParams } from "react-router-dom";

export function DashboardPage() {
  const [params] = useSearchParams();
  const search = params.toString();
  return <Navigate to={search ? `/account/plan?${search}` : "/account"} replace />;
}
