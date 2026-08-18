import { getActiveBrandConfig } from "../../branding/brandRuntime";

export function getMockSystemUsers() {
  return getActiveBrandConfig().mockBrand.users.map((user) => ({ ...user }));
}

export default getMockSystemUsers;
