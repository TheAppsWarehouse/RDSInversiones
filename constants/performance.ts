/** Conservative rendering limits for variable-height financial cards. No fixed-height assumptions. */
export const alertListRendering = {
  initialNumToRender: 6,
  maxToRenderPerBatch: 6,
  windowSize: 7,
  updateCellsBatchingPeriod: 50,
} as const;

export const compactListRendering = {
  initialNumToRender: 10,
  maxToRenderPerBatch: 10,
  windowSize: 9,
  updateCellsBatchingPeriod: 50,
} as const;
