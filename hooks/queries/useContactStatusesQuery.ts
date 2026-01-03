import { useQuery } from "@tanstack/react-query";
import { loadContactStatuses } from "../../services/contactStatusService";
import { withRetry, withTimeout } from "../../utils/helpers";

export const STATUS_KEYS = {
    all: ["statuses"] as const,
    contactStatuses: () => [...STATUS_KEYS.all, "contact"] as const,
};

export const useContactStatusesQuery = () => {
    return useQuery({
        queryKey: STATUS_KEYS.contactStatuses(),
        queryFn: async () => {
            const statuses = await withRetry(
                () => withTimeout(loadContactStatuses(), 12000, "Načtení stavů kontaktů vypršelo"),
                { retries: 1 }
            );
            return statuses;
        },
        staleTime: 10 * 60 * 1000, // Statuses rarely change
    });
};
