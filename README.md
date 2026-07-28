# Kingside — Human vs AI Chess

A polished local chess arena where your side is randomized each match and the
opposing army is powered by OpenAI, Anthropic, your existing Codex subscription,
or a local model that learns from completed games.

![Kingside mid-match on the voxel board, showing the highlighted legal
destinations, the opponent panel, and the move history](static/img/image.png)

## Choose how you play

| Provider | Authentication | Usage |
| --- | --- | --- |
| **Codex SDK** | Sign in to Codex with ChatGPT | Uses your Codex subscription; no API key |
| **OpenAI API** | `OPENAI_API_KEY` | Usage-based API billing |
| **Anthropic API** | `ANTHROPIC_API_KEY` | Usage-based API billing |
| **Trained AI** | None | Local learning model; no SDK or API calls during play |

Codex mode discovers the visible model catalog directly from the signed-in Codex
runtime. The model picker therefore reflects the models currently available to
your account instead of relying on a hard-coded list.

Codex opponents receive only the current board, current-game move history, and
legal moves. Previous games, Coach reports, and your historical tendencies are
never passed to the opponent inference.

When **Trained AI** is selected, the opponent-model picker shows the available
local policy and a preview of the next planned model:

- **Trained AI Default** prioritizes exact historical AI decisions, then uses
  the learned move policy for unseen positions.
- **Trust Value — Coming soon** is visible in the picker but disabled. It has no
  active gameplay implementation yet.

## Local player profiles and permanent Elo

Before starting a match, create or select a local player profile. A username is
permanent after creation and starts at **0 Elo**. This version intentionally
has no passwords: anyone using this copy of the app can select any existing
username from the dropdown. Authentication can be added later without changing
the rating history.

Kingside stores profiles in your operating system's permanent per-user
application-data folder, so names, lifetime records, Elo, game history, and the
Trained AI model survive app restarts, Git pulls, branches, and worktrees. On
macOS that folder is:

```text
~/Library/Application Support/Kingside/
```

Existing repository-local profiles and history are imported automatically the
first time this version starts. Set `KINGSIDE_DATA_DIR` before launching if you
want to use a different permanent location. Both the human profile and the exact
opponent model have persistent ratings. Completed games use standard Elo
expectation math with a K-factor of 32, and every game ID can update ratings only
once.

The profile JSON remains local to your computer and lives outside the Git
checkout. Each game log records the selected username, starting Elo, result,
and final rating change for auditing.

## Start the game

Choose either option below. The `.command` launcher is the easiest approach on
macOS, while the manual instructions give you full control over the Python
environment.

### Option 1: Double-click on macOS

Double-click:

```text
Start Human AI Chess.command
```

The launcher creates a private `.venv`, installs or refreshes the dependencies,
starts the local server, and opens the game in your browser. Keep its Terminal
window open while playing; press Control-C there when you are finished.

### Option 2: Set up Python manually

Requirements:

- Python 3
- A modern web browser
- For Codex mode, Codex signed in with a ChatGPT account

Create the environment and install the project:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Start the game:

```bash
python app.py
```

Then open [http://127.0.0.1:5001](http://127.0.0.1:5001).

The server runs with debugging off. If you are working on the code and want
the reloader and the Werkzeug debugger, opt in explicitly:

```bash
KINGSIDE_DEBUG=1 python app.py
```

Only do that on a machine you trust: the debugger runs arbitrary code for
anyone who can reach the port.

## Playing with your Codex subscription

Codex SDK mode does not read or require `OPENAI_API_KEY` or
`ANTHROPIC_API_KEY`. It uses the authentication from your local Codex sign-in.

1. Sign in to Codex using **Sign in with ChatGPT**:

   ```bash
   codex
   ```

2. Start Kingside and choose **Codex — Subscription**.
3. Choose any model returned by your Codex runtime.
4. Start the match.

If Codex is currently authenticated with an API key, sign out and choose
**Sign in with ChatGPT** so the game can use subscription access. Your normal
Codex subscription limits still apply.

## Playing with an API key

API providers remain fully supported. Create a `.env` file in the project root
and add only the provider you plan to use:

```dotenv
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

Restart the app after changing `.env`, then select **OpenAI — API key** or
**Anthropic — API key** on the match setup screen.

## Running the tests

The Python suite covers the server, provider selection, game records, and
ratings:

```bash
python -m unittest discover -s tests
```

The browser suite covers the board logic in `static/js/chess-logic.js` —
captured-material counting, board orientation, and notation pairing. It uses
Node's built-in test runner, so it needs no dependencies:

```bash
npm test
```

## Game experience

- Fully reconstructed 3D voxel chess set rendered locally with WebGL
- Match-start board selector with **Classic 2D** and **Voxel 3D** modes
- Drag to orbit the board; scroll or pinch to zoom; reset the camera at any time
- Click voxel pieces and squares through 3D raycast selection
- Random White/Black assignment with automatic board rotation and AI-first openings
- Immutable local usernames, passwordless profile switching, and persistent Elo
- Local, non-AI text-to-speech commentator with deterministic move and position narration
- Responsive 3D board for desktop and mobile, with a selectable Classic board
  and automatic 2D fallback if WebGL fails or keyboard board navigation begins
- Drag a piece to its destination on either board, or click the piece and then
  the square; dragging a voxel piece lifts it and orbiting is suspended
- Deep walnut board palette shared by the Classic and Voxel boards
- Captured-material rails showing each side's takes and the point advantage
- Board sized to the viewport height so a full match fits without scrolling
- Resign, take back your last move, claim a draw the position already allows,
  and flip the board to either side
- Click any move in the notation panel to review the position after it, then
  click it again or press Escape to return to the live game
- Legal destination and capture indicators
- Persistent last-move and check highlighting
- Live AI thinking timer and reasoning notes
- SAN move history
- Timestamped JSON game records saved at match creation and after every move;
  abandoned test games remain explicitly marked as **incomplete**
- Private mid-game position-memory hints when your current board closely matches
  a position from one of your own completed games
- Automatic Codex Coach review after each completed game, with four tactical
  themes, the tactic you demonstrated, one-line play-style insight, opponent
  model, concrete mistakes, and a next-game focus
- Promotion selection
- Accessible labels, keyboard focus states, and reduced-motion support

Live game state stays in the local Flask process. Every match also gets a
recoverable JSON record in the permanent `game_logs/` data folder, including
its date and time, colors, opponent provider and model, timestamped UCI/SAN
moves, FEN after every ply, final PGN, result, and post-game coaching report.

The end-game coach always uses the signed-in Codex SDK with your ChatGPT
subscription—no API key—even when the opponent was OpenAI API or Anthropic API.
It runs once when the game ends, then caches the result in that match’s JSON
file. If the review is interrupted, the game record remains intact and the UI
offers a retry.

Every completed game updates the permanent `trained_ai/model.json` with the
AI-authored moves and the final AI-side outcome. Human moves are replayed only
to reconstruct each position; they are never learned as opponent tendencies.
The post-game Codex Coach can add richer strategy labels, but a successful
Coach run is not required
for the game to become training data.

During a **Trained AI** match, no LLM is called. The local policy first checks
for an exact position and gives earlier AI decisions priority. If the position
is new, a small outcome-weighted linear model ranks every legal move using what
it learned from prior AI wins, draws, and losses. Only a completely empty
dataset uses the minimal development-and-safety fallback.

Hover the Trained AI opponent name—or focus and click its decision-tree
button—to inspect the live decision path, dataset size, strategies learned,
candidate moves, outcome probabilities, and the factors that most influenced
the selected branch. A separate learned position-value model also estimates the
Trained AI’s win probability after every move. The hover panel shows the current
percentage and a compact forecast history for the match; those per-ply forecasts
are saved with the game JSON.

API requests for chess moves are sent only to the provider selected for the
current match.

The voxel renderer vendors [Three.js](https://threejs.org/) under its MIT
license so the board does not depend on a CDN at runtime.
