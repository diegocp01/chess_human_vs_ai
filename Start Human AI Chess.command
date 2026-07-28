#!/bin/zsh

set -u

SCRIPT_DIR="${0:A:h}"
VENV_DIR="$SCRIPT_DIR/.venv"
PYTHON_BIN="$VENV_DIR/bin/python"
REQUIREMENTS="$SCRIPT_DIR/requirements.txt"
INSTALL_STAMP="$VENV_DIR/.requirements-installed"
GAME_URL="http://127.0.0.1:5001"

cd "$SCRIPT_DIR" || exit 1

echo
echo "♟  Human vs AI Chess"
echo "────────────────────────────────────────"

if [[ ! -x "$PYTHON_BIN" ]]; then
    echo "Creating the game environment (first launch only)..."
    if ! command -v python3 >/dev/null 2>&1; then
        echo
        echo "Python 3 is required but was not found."
        echo "Install Python 3, then double-click this file again."
        echo
        read "?Press Return to close..."
        exit 1
    fi

    if ! python3 -m venv "$VENV_DIR"; then
        echo
        echo "Could not create the Python environment."
        read "?Press Return to close..."
        exit 1
    fi
fi

if [[ ! -f "$INSTALL_STAMP" || "$REQUIREMENTS" -nt "$INSTALL_STAMP" ]]; then
    echo "Installing game dependencies..."
    if ! "$PYTHON_BIN" -m pip install -r "$REQUIREMENTS"; then
        echo
        echo "Dependency installation failed. Check your internet connection,"
        echo "then double-click this file to try again."
        echo
        read "?Press Return to close..."
        exit 1
    fi
    touch "$INSTALL_STAMP"
fi

echo "Starting the game at $GAME_URL"
echo "Keep this Terminal window open while you play."
echo "Press Control-C here when you are finished."
echo

(
    sleep 1.5
    open "$GAME_URL"
) &

"$PYTHON_BIN" -c 'from app import app; app.run(debug=False, port=5001)'
STATUS=$?

if [[ "$STATUS" -ne 0 && "$STATUS" -ne 130 ]]; then
    echo
    echo "The game stopped with an error (status $STATUS)."
    read "?Press Return to close..."
fi

exit "$STATUS"
