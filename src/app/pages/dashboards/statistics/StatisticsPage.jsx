import { StatisticsSection } from "../../../components/dashboard/StatisticsSection";
import { useAuth } from "../../../context/AuthContext";

export default function StatisticsPage() {
  const { user, isThirdPartyVendor } = useAuth();
  const vendor = isThirdPartyVendor();
  return (
    <div className="space-y-8">
      <StatisticsSection
        lockInstitution={vendor}
        statsInstitution={vendor ? user?.institutionCode || "" : undefined}
        institutionDisplayName={vendor ? user?.institutionName || user?.institutionCode : undefined}
      />
    </div>
  );
}
