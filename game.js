// Shared pure game logic for Plusminus.
// Loads in both the browser (attaches to window.Game) and Node (module.exports).
//
// Two variants, both solved games on the same underlying maths:
//   'add' — total starts at 0; players add 1..maxAdd; first to reach `target` WINS.
//   'sub' — total starts at `target`; players subtract (never below 0); whoever lands
//           exactly on 0 LOSES. This is the misère form.

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

  // The two game variants, with the wording the UI and docs draw from.
  const VARIANTS = {
    add: {
      key: 'add', name: 'Addition', sign: '+', verb: 'added', stepLabel: 'Max add',
      tagline: 'Add up to Max add each turn. First to reach the Target wins.',
    },
    sub: {
      key: 'sub', name: 'Subtraction', sign: '−', verb: 'subtracted', stepLabel: 'Max subtract',
      tagline: 'Subtract up to Max subtract each turn. Whoever lands on zero loses.',
    },
  };

  function variantValid(v) {
    return Object.prototype.hasOwnProperty.call(VARIANTS, v);
  }

  function variantOf(state) {
    return state.variant === 'sub' ? 'sub' : 'add';
  }

  // Do target/maxAdd satisfy all range rules? (Authoritative check, shared with server.)
  function paramsValid(target, maxAdd) {
    const L = PARAM_LIMITS;
    if (!Number.isInteger(target) || target < L.targetMin || target > L.targetMax) return false;
    if (!Number.isInteger(maxAdd) || maxAdd < L.maxAddMin || maxAdd > L.maxAddMax) return false;
    const ratio = target / (maxAdd + 1);
    return ratio >= L.ratioMin && ratio <= L.ratioMax;
  }

  // Create a fresh game state. Player is 1 or 2. `firstPlayer` chooses who moves
  // first (defaults to 1). `variant` is 'add' or 'sub' (defaults to 'add').
  function createState(target, maxAdd, firstPlayer, variant) {
    const v = variantValid(variant) ? variant : 'add';
    return {
      target: target,
      // The per-turn limit. Named for the original addition game; in 'sub' it is the
      // most you may subtract.
      maxAdd: maxAdd,
      variant: v,
      total: v === 'sub' ? target : 0, // 'sub' counts down from the target to zero
      currentPlayer: firstPlayer === 2 ? 2 : 1,
      winner: null, // null while playing, else 1 or 2
    };
  }

  // The largest legal amount right now. In 'sub' you may never go below zero, so near
  // the end the choice narrows — that squeeze is what forces someone onto zero.
  function maxLegal(state) {
    return variantOf(state) === 'sub' ? Math.min(state.maxAdd, state.total) : state.maxAdd;
  }

  // Is `n` a legal move in the given state?
  function isValidMove(state, n) {
    return (
      state.winner === null &&
      Number.isInteger(n) &&
      n >= 1 &&
      n <= maxLegal(state)
    );
  }

  // Apply move `n`, mutating and returning the state. Assumes isValidMove passed.
  function applyMove(state, n) {
    if (variantOf(state) === 'sub') {
      state.total -= n;
      // Landing on zero loses, so the WINNER is the other player. Recording it this way
      // keeps every downstream winner check (banner, scores, rematch) unchanged.
      if (state.total === 0) {
        state.winner = state.currentPlayer === 1 ? 2 : 1;
        return state;
      }
      state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
      return state;
    }
    state.total += n;
    if (state.total >= state.target) {
      state.winner = state.currentPlayer;
    } else {
      state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
    }
    return state;
  }

  // Concede the game: `player` gives the win to their opponent. Works for both variants,
  // since both express their outcome through `winner`. No-op once a game is decided.
  function resign(state, player) {
    if (state.winner !== null) return state;
    state.winner = player === 1 ? 2 : 1;
    state.resignedBy = player;
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
    return 1 + Math.floor(Math.random() * maxLegal(state));
  }

  // Optimal move for the current player (used by the AI and as a hint).
  //
  // Both variants hinge on residues mod (maxAdd + 1), but on different ones:
  //   'add' — hand the opponent a multiple of k, i.e. remaining ≡ 0 (mod k).
  //   'sub' — hand the opponent total ≡ 1 (mod k). At total 1 they must take 1 and lose.
  function bestMove(state) {
    const k = state.maxAdd + 1;
    if (variantOf(state) === 'sub') {
      if (state.total - 1 <= state.maxAdd && state.total >= 2) return state.total - 1; // leave them on 1
      const n = state.total % k === 1 ? 0 : (state.total - 1) % k;
      return n !== 0 ? n : randomMove(state); // 0 means the position is already lost
    }
    const remaining = state.target - state.total;
    if (remaining <= state.maxAdd) return remaining; // win immediately
    const n = remaining % k;
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
    for (let i = 1; i <= maxLegal(state); i++) if (i !== avoid) options.push(i);
    if (options.length === 0) return avoid; // only one legal move: no way to blunder
    return options[Math.floor(Math.random() * options.length)];
  }

  // The move the computer actually plays at the given skill level.
  function cpuMove(state, level) {
    // Every level takes a win it can see this turn — missing that looks broken, not easy.
    if (variantOf(state) === 'sub') {
      // Leaving the opponent on exactly 1 wins outright: they must take it and hit zero.
      if (state.total - 1 <= state.maxAdd && state.total >= 2) return state.total - 1;
    } else {
      const remaining = state.target - state.total;
      if (remaining <= state.maxAdd) return remaining;
    }
    const best = bestMove(state);
    if (Math.random() < difficultyFor(level).accuracy) return best;
    return randomOtherMove(state, best);
  }

  // Cut-and-choose seat pick for the computer. Weaker levels often pick the losing seat.
  // Returns the player number to move first (1 = human, 2 = computer).
  //
  // The winning seat differs by variant: the first mover loses on target ≡ 0 (mod k) in
  // 'add', but on target ≡ 1 (mod k) in 'sub'.
  function chooseSeatFor(target, maxAdd, level, variant) {
    const k = maxAdd + 1;
    const firstMoverWins = variant === 'sub' ? target % k !== 1 : target % k !== 0;
    const wantsWinningSeat = Math.random() < difficultyFor(level).seatAccuracy;
    const computerFirst = wantsWinningSeat ? firstMoverWins : !firstMoverWins;
    return computerFirst ? 2 : 1;
  }

  return {
    createState, isValidMove, applyMove, bestMove, paramsValid, PARAM_LIMITS,
    DIFFICULTY, cpuMove, chooseSeatFor,
    TURN_SECONDS_CHOICES, TURN_SECONDS_DEFAULT, turnSecondsValid, randomMove,
    VARIANTS, variantValid, maxLegal, resign,
  };
});
