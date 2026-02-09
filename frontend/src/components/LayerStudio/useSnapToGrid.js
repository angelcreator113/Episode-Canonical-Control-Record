export const useSnapToGrid = (gridSize = 50, enabled = true) => {
  const snapToGrid = (value) => {
    if (!enabled) return value;
    return Math.round(value / gridSize) * gridSize;
  };

  const snapPosition = (x, y) => {
    if (!enabled) return { x, y };
    return {
      x: snapToGrid(x),
      y: snapToGrid(y)
    };
  };

  return { snapToGrid, snapPosition };
};

export default useSnapToGrid;
