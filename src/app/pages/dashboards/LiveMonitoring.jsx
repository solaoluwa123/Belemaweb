import { useAuth } from "../../context/AuthContext";
import { LiveInstitutionFlowMonitor } from "../../components/dashboard/LiveInstitutionFlowMonitor";

export default function LiveMonitoring() {
  const { isThirdPartyVendor, user } = useAuth();

  const institutionCode = isThirdPartyVendor() ? user?.institutionCode || null : null;

  return (
    <LiveInstitutionFlowMonitor
      institutionCode={institutionCode}
      showInstitutionFilter={!isThirdPartyVendor()}
    />
  );
}
