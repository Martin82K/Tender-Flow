export const formatOrgRole = (role: string | null | undefined): string => {
  if (!role) return "Neznámá role";
  if (role === "owner") return "Vlastník";
  if (role === "admin") return "Administrátor";
  if (role === "member") return "Člen";
  return role;
};

export const formatOrgRequestStatus = (status: string | null | undefined): string => {
  if (!status) return "Bez žádosti";
  if (status === "pending") return "Čeká na schválení";
  if (status === "approved") return "Schváleno";
  if (status === "rejected") return "Zamítnuto";
  return status;
};

export const isOrgAdminRole = (role: string | null | undefined): boolean => {
  return role === "owner" || role === "admin";
};
