// Shared pure game logic for the Adding Number Game.
// Loads in both the browser (attaches to window.Game) and Node (module.exports).
//
// Rules: total starts at 0. Players alternate adding an integer from 1..maxAdd.
// The first player whose total reaches or exceeds `target` wins.

(function (root, factory) {
  const api = factory();
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; // Node (server.js)
  } else {
    root.Game = api; // Browser (public/index.html)
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // Allowed parameter ranges. Target/(maxAdd+1) is the number of full "cycles" and is
  // kept in [8,15] so games are neither too short nor too long.
  const PARAM_LIMITS = {
    targetMin: 24, targetMax: 150,
    maxAddMin: 2, maxAddMax: 15,
    ratioMin: 8, ratioMax: 15,
  };

  // Do target/maxAdd satisfy all range rules? (Authoritative check, shared with server.)
  function paramsValid(target, maxAdd) {
    const L = PARAM_LIMITS;
    if (!Number.isInteger(target) || target < L.targetMin || target > L.targetMax) return false;
    if (!Number.isInteger(maxAdd) || maxAdd < L.maxAddMin || maxAdd > L.maxAddMax) return false;
    const ratio = target / (maxAdd + 1);
    return ratio >= L.ratioMin && ratio <= L.ratioMax;
  }

  // Create a fresh game state. Player is 1 or 2. `firstPlayer` chooses who moves
  // first (defaults to 1).
  function createState(target, maxAdd, firstPlayer) {
    return {
      target: target,
      maxAdd: maxAdd,
      total: 0,
      currentPlayer: firstPlayer === 2 ? 2 : 1,
      winner: null, // null while playing, else 1 or 2
    };
  }

  // Is `n` a legal move in the given state?
  function isValidMove(state, n) {
    return (
      state.winner === null &&
      Number.isInteger(n) &&
      n >= 1 &&
      n <= state.maxAdd
    );
  }

  // Apply move `n`, mutating and returning the state. Assumes isValidMove passed.
  function applyMove(state, n) {
    state.total += n;
    if (state.total >= state.target) {
      state.winner = state.currentPlayer;
    } else {
      state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
    }
    return state;
  }

  // Optimal move for the current player (used by the AI and as a hint).
  // Leaves the opponent on a multiple of (maxAdd + 1) whenever possible.
  function bestMove(state) {
    const remaining = state.target - state.total;
    if (remaining <= state.maxAdd) return remaining; // win immediately
    const n = remaining % (state.maxAdd + 1);
    if (n !== 0) return n; // winning move: leave opponent on a multiple of (maxAdd+1)
    // Losing position: no move helps, so play a random legal amount (1..maxAdd)
    // instead of always the same value, to stay unpredictable.
    return 1 + Math.floor(Math.random() * state.maxAdd);
  }

  return { createState, isValidMove, applyMove, bestMove, paramsValid, PARAM_LIMITS };
});
