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

  // Turn clock options, in seconds (0 = no timer). When a turn runs out, a random
  // legal amount is added for that player so the game can't stall.
  const TURN_SECONDS_CHOICES = [0, 30, 60, 120];
  const TURN_SECONDS_DEFAULT = 30;

  function turnSecondsValid(s) {
    return TURN_SECONDS_CHOICES.indexOf(s) !== -1;
  }

  // Any legal amount, chosen uniformly. Used for timed-out turns.
  function randomMove(state) {
    return 1 + Math.floor(Math.random() * state.maxAdd);
  }

  // Optimal move for the current player (used by the AI and as a hint).
  // Leaves the opponent on a multiple of (maxAdd + 1) whenever possible.
  function bestMove(state) {
    const remaining = state.target - state.total;
    if (remaining <= state.maxAdd) return remaining; // win immediately
    const n = remaining % (state.maxAdd + 1);
    if (n !== 0) return n; // winning move: leave opponent on a multiple of (maxAdd+1)
    // Losing position: no move helps, so play a random legal amount instead of
    // always the same value, to stay unpredictable.
    return randomMove(state);
  }

  // Computer skill levels. `accuracy` is how often it finds the optimal move;
  // `seatAccuracy` is how often it claims the winning seat in cut-and-choose.
  // Legendary is perfect play, which in this solved game is unbeatable from a won seat.
  const DIFFICULTY = {
    beginner: { name: 'Beginner', accuracy: 0.35, seatAccuracy: 0.25 },
    pro: { name: 'Pro', accuracy: 0.8, seatAccuracy: 0.85 },
    legendary: { name: 'Legendary', accuracy: 1, seatAccuracy: 1 },
  };

  function difficultyFor(level) {
    return DIFFICULTY[level] || DIFFICULTY.legendary;
  }

  // A random legal move other than `avoid` — a deliberate blunder.
  function randomOtherMove(state, avoid) {
    const options = [];
    for (let i = 1; i <= state.maxAdd; i++) if (i !== avoid) options.push(i);
    if (options.length === 0) return avoid; // shouldn't happen (maxAdd >= 2)
    return options[Math.floor(Math.random() * options.length)];
  }

  // The move the computer actually plays at the given skill level.
  function cpuMove(state, level) {
    const remaining = state.target - state.total;
    // Every level takes a win it can see this turn — missing that looks broken, not easy.
    if (remaining <= state.maxAdd) return remaining;
    const best = bestMove(state);
    if (Math.random() < difficultyFor(level).accuracy) return best;
    return randomOtherMove(state, best);
  }

  // Cut-and-choose seat pick for the computer. The first mover wins with perfect play
  // unless target is a multiple of (maxAdd + 1). Weaker levels often pick the losing seat.
  // Returns the player number to move first (1 = human, 2 = computer).
  function chooseSeatFor(target, maxAdd, level) {
    const firstMoverWins = target % (maxAdd + 1) !== 0;
    const wantsWinningSeat = Math.random() < difficultyFor(level).seatAccuracy;
    const computerFirst = wantsWinningSeat ? firstMoverWins : !firstMoverWins;
    return computerFirst ? 2 : 1;
  }

  return {
    createState, isValidMove, applyMove, bestMove, paramsValid, PARAM_LIMITS,
    DIFFICULTY, cpuMove, chooseSeatFor,
    TURN_SECONDS_CHOICES, TURN_SECONDS_DEFAULT, turnSecondsValid, randomMove,
  };
});
