/**
 * React Query hooks for all backend reads. Each polls on an interval so the
 * dashboard and tables stay live; after a transaction confirms, pages also call
 * queryClient.invalidateQueries() for instant updates instead of waiting a tick.
 */
import { useQuery } from "@tanstack/react-query";
import {
  apiGetStats,
  apiGetLots,
  apiGetRoles,
  apiGetBatchesByFactory,
  apiGetFurnitures,
  apiVerify,
} from "../lib/api.js";

const POLL_MS = 5000;

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: apiGetStats,
    refetchInterval: POLL_MS,
  });
}

export function useLots() {
  return useQuery({
    queryKey: ["lots"],
    queryFn: apiGetLots,
    refetchInterval: POLL_MS,
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: apiGetRoles,
    refetchInterval: POLL_MS,
  });
}

export function useBatchesByFactory(factory) {
  return useQuery({
    queryKey: ["batches", factory?.toLowerCase() || "all"],
    queryFn: () => apiGetBatchesByFactory(factory),
    enabled: Boolean(factory),
    refetchInterval: POLL_MS,
  });
}

export function useAllBatches() {
  return useQuery({
    queryKey: ["batches", "all"],
    queryFn: () => apiGetBatchesByFactory(null),
    refetchInterval: POLL_MS,
  });
}

export function useFurnitures() {
  return useQuery({
    queryKey: ["furnitures"],
    queryFn: apiGetFurnitures,
    refetchInterval: POLL_MS,
  });
}

export function useVerify(furnitureId) {
  return useQuery({
    queryKey: ["verify", furnitureId],
    queryFn: () => apiVerify(furnitureId),
    enabled: Boolean(furnitureId),
    retry: false,
  });
}
