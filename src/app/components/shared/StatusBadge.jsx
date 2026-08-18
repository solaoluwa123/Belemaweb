import { Badge } from "../ui/badge";

export function StatusBadge({ status, type = "transaction" }) {
  const getVariant = () => {
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes("success") || statusLower.includes("approved") || statusLower.includes("accepted") || statusLower.includes("completed") || statusLower.includes("settled") || statusLower.includes("active") || statusLower.includes("resolved")) {
      return "default";
    }
    if (statusLower.includes("pending") || statusLower.includes("processing")) {
      return "secondary";
    }
    if (statusLower.includes("failed") || statusLower.includes("rejected") || statusLower.includes("declined") || statusLower.includes("inactive") || statusLower.includes("suspended")) {
      return "destructive";
    }
    if (statusLower.includes("arbitrated") || statusLower.includes("review") || statusLower.includes("escalated")) {
      return "outline";
    }
    return "default";
  };

  const getColor = () => {
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes("success") || statusLower.includes("approved") || statusLower.includes("accepted") || statusLower.includes("completed") || statusLower.includes("settled") || statusLower.includes("active") || statusLower.includes("resolved")) {
      return "bg-green-100 text-green-800 hover:bg-green-100";
    }
    if (statusLower.includes("pending") || statusLower.includes("processing")) {
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
    }
    if (statusLower.includes("failed") || statusLower.includes("rejected") || statusLower.includes("declined") || statusLower.includes("inactive") || statusLower.includes("suspended")) {
      return "bg-red-100 text-red-800 hover:bg-red-100";
    }
    if (statusLower.includes("arbitrated") || statusLower.includes("review") || statusLower.includes("escalated")) {
      return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    }
    return "bg-gray-100 text-gray-800 hover:bg-gray-100";
  };

  return (
    <Badge variant={getVariant()} className={getColor()}>
      {status}
    </Badge>
  );
}