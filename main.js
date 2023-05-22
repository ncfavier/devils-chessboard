import { h, text, app } from "https://cdnjs.cloudflare.com/ajax/libs/hyperapp/2.0.22/index.min.js";

const [SET_UP_BOARD, FLIP_COIN, FIND_SQUARE, DONE] = Array(4).keys();

const randomInt = n => Math.floor(Math.random() * n);
const randomBool = () => Math.random() < 0.5;
const randomSquares = () => Array.from({length: 8}, () => Array.from({length: 8}, () => randomBool()));
const randomSquare = () => [randomInt(8), randomInt(8)];

const serialise = state => {
  let rows = state.squares.map(row => row.reduce((a, b, i) => a | b << i));
  rows.unshift(state.square[0] | state.square[1] << 3 | (state.phase > FLIP_COIN) << 6);
  return btoa(rows.map(i => String.fromCharCode(i)).join('')).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

const deserialise = s => {
  const [b, ...squares] = Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  if (squares.length !== 8) throw "Invalid state";
  return {
    squares: squares.map(r => Array.from({length: 8}, (_, j) => Boolean((r >> j) & 0b1))),
    square: [b & 0b111, (b >> 3) & 0b111],
    phase: (b >> 6) & 0b1 ? FIND_SQUARE : FLIP_COIN
  };
};

const params = new URLSearchParams(window.location.search);

// SPOILERS
const findSquare = squares => {
  let square = [0, 0];
  for (let i = 1; i < 8; i++) for (let j = 0; j < 8; j++) {
    if (squares[i][j]) square[0] ^= i;
    if (squares[j][i]) square[1] ^= i;
  }
  return square;
};
// END SPOILERS

let init = null;

if (params.has('s')) {
  try {
    init = deserialise(params.get('s'));
  } catch (error) {
    alert("Invalid state");
  }
}

const initPhase = params.has('devil') ? SET_UP_BOARD : params.has('bob') ? FIND_SQUARE : FLIP_COIN;

if (init === null) {
  const squares = initPhase === SET_UP_BOARD ? Array.from({length: 8}, () => Array(8).fill(0)) : randomSquares();
  init = {
    squares,
    square: initPhase === SET_UP_BOARD ? [0, 0] : initPhase === FIND_SQUARE ? findSquare(squares) : randomSquare(),
    phase: initPhase
  };
}

const savedDark = localStorage.getItem('dark');
init.dark = savedDark !== null ? savedDark === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;

const link = state => '?' + (new URLSearchParams({s: serialise(state)})).toString();

const updateLocation = (_, state) => history.replaceState(null, '', link(state));

const clickSquare = (state, [i, j]) => {
  if (state.phase === SET_UP_BOARD) {
    if (state.moveSquare) {
      state.square = [i, j];
      state.moveSquare = false;
    } else
      state.squares[i][j] = !state.squares[i][j];
  } else if (state.phase === FLIP_COIN) {
    state.squares[i][j] = !state.squares[i][j];
    state.phase = FIND_SQUARE;
  } else if (state.phase === FIND_SQUARE) {
    state.phase = DONE;
    state.correct = state.square[0] === i && state.square[1] === j;
  }
  return [{...state}, [updateLocation, state]];
};

const randomise = state => {
  state.squares = randomSquares();
  state.square = randomSquare();
  return [{...state}, [updateLocation, state]];
}

const view = state => h('body', {class: {dark: state.dark}}, [
  h('button', {
    id: 'lights',
    onclick: state => [{...state, dark: !state.dark}, () => localStorage.setItem('dark', !state.dark)]
  }, text(state.dark ? "☀️" : "🌑")),
  h('table', {id: 'board'}, Array.from({length: 8}, (_, i) =>
    h('tr', {}, Array.from({length: 8}, (_, j) =>
      h('td', {class: {
        square: true,
        flipped: state.squares[i][j],
        chosen: state.phase !== FIND_SQUARE && state.square[0] === i && state.square[1] === j
      }, onclick: [clickSquare, [i, j]]})
    ))
  )),
  h('aside', {}, [
    h('h1', {}, [
      text("The Devil's chessboard"),
      h('a', {id: 'github', href: "https://git.monade.li/devils-chessboard"}, h('i', {class: 'fa-brands fa-github'}, []))
    ]),
    h('details', {}, [
      h('summary', {}, text("Rules")),
      h('div', {class: 'indent'}, [
        h('p', {}, text("Two lost souls, Alice and Bob, will be granted freedom from Hell if they can complete the following task: first, the Devil places a coin on each of the 64 squares of a chessboard, either heads or tails up (shown as black and white squares), as he sees fit, and tells Alice his \"favourite\" square; then, Alice chooses exactly one coin on the board and flips it; finally, Bob comes in and has to find the Devil's square without communicating with Alice in any way.")),
        h('p', {}, text("Of course, Alice and Bob can devise a strategy before the challenge begins. The goal is to find a strategy that will always allow Alice to tell Bob the chosen square with a single coin flip.")),
        h('p', {}, [text("It's a fun puzzle! You should think about it. If you just want the solution, watch this "), h('a', {href: "https://www.youtube.com/watch?v=wTJI_WuZSwE"}, text("video")), text(".")])
      ])
    ]),
    h('p', {}, [
      text("Play as "),
      h('a', {href: '?devil', class: {current: state.phase === SET_UP_BOARD}}, text("the Devil")), text(" | "),
      h('a', {href: '.', class: {current: state.phase === FLIP_COIN}}, text("Alice")), text(" | "),
      h('a', {href: '?bob', class: {current: state.phase >= FIND_SQUARE}}, text("Bob"))
    ]),
    h('p', {class: 'indent'},
      state.phase < FLIP_COIN
    ? text("Set up the board to your liking, then share the URL with Alice.")
    : state.phase === FLIP_COIN
    ? [text("The Devil has set up the board and shown you his favourite square."), h('br', {}), text("Click a square to flip it, then share the URL with Bob.")]
    : state.phase === FIND_SQUARE
    ? text("Alice has flipped a coin; find the Devil's square.")
    : state.correct
    ? [h('span', {class: 'right'}, text("Well done!")), text(" You are free to go.")]
    : [h('span', {class: 'wrong'}, text("Wrong!")), text(" You stay in Hell.")]
    ),
    h('div', {}, [
      h('button', {
        hidden: state.phase !== SET_UP_BOARD,
        onclick: randomise
      }, text("Randomise")),
      h('button', {
        hidden: state.phase !== SET_UP_BOARD,
        disabled: state.moveSquare,
        onclick: state => ({...state, moveSquare: true})
      }, text("Choose a square")),
      h('button', {
        hidden: state.phase !== SET_UP_BOARD,
        onclick: state => {
          state.phase = FLIP_COIN;
          return [{...state}, [updateLocation, state]];
        }
      }, text("Done"))
    ]),
    h('details', {hidden: initPhase !== FIND_SQUARE, id: 'strategy'}, [
      // SPOILERS
      h('summary', {}, text("Alice's strategy (spoilers)")),
      text("For each region in {efgh, cdgh, bdfh, 5678, 3478, 2468} (where a1 = top left), an odd number of dark squares means the chosen square is in that region.")
    ]) // END SPOILERS
  ]),
]);

app({
  node: document.body,
  init,
  view
});
