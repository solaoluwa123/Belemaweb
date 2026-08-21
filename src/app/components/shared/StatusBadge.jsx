import { Badge } from "../ui/badge";

export function StatusBadge({ status, type = "transaction" }) {
  const label = String(status ?? "").trim() || "Unknown";
  const statusLower = label.toLowerCase();
  void type;

  const getColor = () => {
    if (
      statusLower.includes("success") ||
      statusLower.includes("approved") ||
      statusLower.includes("accepted") ||
      statusLower.includes("completed") ||
      statusLower.includes("settled") ||
      statusLower.includes("active") ||
      statusLower.includes("resolved")
    ) {
      return "border-transparent bg-green-100 text-green-800 hover:bg-green-100";
    }
    if (statusLower.includes("pending") || statusLower.includes("processing")) {
      return "border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
    }
    if (
      statusLower.includes("failed") ||
      statusLower.includes("rejected") ||
      statusLower.includes("declined") ||
      statusLower.includes("inactive") ||
      statusLower.includes("suspended")
    ) {
      return "border-transparent bg-red-100 text-red-800 hover:bg-red-100";
    }
    if (
      statusLower.includes("arbitrated") ||
      statusLower.includes("review") ||
      statusLower.includes("escalated")
    ) {
      return "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-100";
    }
    return "border-transparent bg-gray-100 text-gray-800 hover:bg-gray-100";
  };

  return (
    <Badge variant="outline" className={getColor()}>
      {label}
    </Badge>
  );
}
