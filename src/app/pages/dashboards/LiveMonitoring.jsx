import { Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { LiveMonitoringSection } from "../../components/dashboard/LiveMonitoringSection";

export default function LiveMonitoring() {
  const { isThirdPartyVendor, user } = useAuth();

  if (isThirdPartyVendor()) {
    return <Navigate to="/" replace />;
  }

  const institutionCode = isThirdPartyVendor() ? user?.institutionCode : null;

  return (
    <div className="space-y-8">
      <LiveMonitoringSection
        institutionCode={institutionCode}
        compact={false}
        autoRefresh
        showHeader
      />
    </div>
  );
}
