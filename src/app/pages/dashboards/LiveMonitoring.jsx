import { useAuth } from "../../context/AuthContext";
import { LiveTransactionFeed } from "../../components/dashboard/LiveTransactionFeed";

export default function LiveMonitoring() {
  const { isThirdPartyVendor, user } = useAuth();

  const institutionCode = isThirdPartyVendor() ? user?.institutionCode || null : null;

  return (
    <LiveTransactionFeed
      institutionCode={institutionCode}
      showInstitutionFilter={!isThirdPartyVendor()}
    />
  );
}
