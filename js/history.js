/* ============================================
   History — Undo/Redo (Command Pattern)
   ============================================ */

const History = (() => {
  const stack = [];
  let pointer = -1;
  const MAX_HISTORY = 50;

  /**
   * Push current state to history
   */
  function push() {
    const snapshot = deepClone(State.getState());
    // Remove future states if we branched
    stack.splice(pointer + 1);
    stack.push(snapshot);

    // Limit stack size
    if (stack.length > MAX_HISTORY) {
      stack.shift();
    }
    pointer = stack.length - 1;
  }

  /**
   * Undo — go back one step
   */
  function undo() {
    if (pointer <= 0) return false;
    pointer--;
    const snapshot = deepClone(stack[pointer]);
    State.replaceState(snapshot);
    return true;
  }

  /**
   * Redo — go forward one step
   */
  function redo() {
    if (pointer >= stack.length - 1) return false;
    pointer++;
    const snapshot = deepClone(stack[pointer]);
    State.replaceState(snapshot);
    return true;
  }

  /**
   * Clear history
   */
  function clear() {
    stack.length = 0;
    pointer = -1;
  }

  /**
   * Check if undo is available
   */
  function canUndo() {
    return pointer > 0;
  }

  /**
   * Check if redo is available
   */
  function canRedo() {
    return pointer < stack.length - 1;
  }

  return { push, undo, redo, clear, canUndo, canRedo };
})();
