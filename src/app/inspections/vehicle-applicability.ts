export type InspectionVehicleType = "motorcycle" | "scooter";

type VehicleApplicableCheckpoint = {
  active_for: "both" | InspectionVehicleType;
};

export function filterCheckpointsForVehicle<T extends VehicleApplicableCheckpoint>(
  checkpoints: readonly T[],
  vehicleType: InspectionVehicleType
): T[] {
  return checkpoints.filter(
    (checkpoint) =>
      checkpoint.active_for === "both" ||
      checkpoint.active_for === vehicleType
  );
}
