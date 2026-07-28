import unittest
from unittest.mock import patch
import json
import tempfile
from pathlib import Path

import chess

import app as app_module
from chess_ai import (
    CODEX_COACH_INSTRUCTIONS,
    generate_chess_prompt,
    generate_codex_coach_prompt,
)
from trained_ai import (
    choose_trained_move,
    predict_trained_win_probability,
    rebuild_trained_model,
)


CODEX_MODELS = [
    {
        "id": "gpt-test",
        "display": "GPT Test",
        "description": "Test-only Codex model",
        "is_default": True,
        "default_reasoning_effort": "medium",
        "reasoning_efforts": ["low", "medium"],
    }
]


class KingsideTestCase(unittest.TestCase):
    """Shared fixture: isolated game logs, trained model, and player profiles."""

    def setUp(self):
        app_module.app.config["TESTING"] = True
        app_module.GAME_STATE = {}
        self.log_directory = tempfile.TemporaryDirectory()
        self.original_log_directory = app_module.GAME_LOG_DIR
        self.original_trained_model_path = app_module.TRAINED_AI_MODEL_PATH
        self.original_player_data_path = app_module.PLAYER_DATA_PATH
        app_module.GAME_LOG_DIR = Path(self.log_directory.name)
        app_module.TRAINED_AI_MODEL_PATH = Path(self.log_directory.name) / "trained-model.json"
        app_module.PLAYER_DATA_PATH = Path(self.log_directory.name) / "profiles.json"
        self.player = app_module.create_player(
            app_module.PLAYER_DATA_PATH,
            "Test Player",
        )
        self.client = app_module.app.test_client()

    def tearDown(self):
        app_module.GAME_LOG_DIR = self.original_log_directory
        app_module.TRAINED_AI_MODEL_PATH = self.original_trained_model_path
        app_module.PLAYER_DATA_PATH = self.original_player_data_path
        self.log_directory.cleanup()


class ProviderSelectionTests(KingsideTestCase):
    def write_coached_game(self, suffix="01", tactic="Kingside initiative"):
        record = {
            "schema_version": 1,
            "game_id": f"historic-{suffix}",
            "started_at": f"2026-07-{suffix}T20:00:00Z",
            "ended_at": f"2026-07-{suffix}T20:30:00Z",
            "human_color": "white",
            "opponent": {
                "provider": "codex",
                "model_id": "gpt-test",
                "display_name": "GPT Test",
            },
            "result": {
                "winner": "ai",
                "description": "Checkmate! AI wins!",
                "chess_result": "0-1",
            },
            "coach": {
                "status": "complete",
                "tactic_used": tactic,
                "one_line_insight": "You attack early and accept king-safety risk.",
                "what_went_wrong": ["The early g-pawn push opened your king."],
                "best_improvement": "Scan forcing checks before starting an attack.",
                "tactics": [
                    {"name": tactic, "used": True},
                    {"name": "Central control", "used": False},
                    {"name": "Development", "used": False},
                    {"name": "King safety", "used": False},
                ],
            },
        }
        path = app_module.GAME_LOG_DIR / f"historic-{suffix}.json"
        path.write_text(json.dumps(record), encoding="utf-8")
        return path

    def write_position_memory_game(self, player_id=None):
        record = {
            "schema_version": 1,
            "game_id": "historic-position-memory",
            "started_at": "2026-07-20T20:00:00Z",
            "ended_at": "2026-07-20T20:30:00Z",
            "human_color": "white",
            "player": {
                "id": player_id or self.player["id"],
                "username": "Test Player",
            },
            "opponent": {
                "provider": "codex",
                "model_id": "gpt-test",
                "display_name": "GPT Test",
            },
            "moves": [
                {"ply": 1, "actor": "human", "uci": "e2e4", "san": "e4"},
                {"ply": 2, "actor": "ai", "uci": "e7e5", "san": "e5"},
                {"ply": 3, "actor": "human", "uci": "g1f3", "san": "Nf3"},
                {"ply": 4, "actor": "ai", "uci": "b8c6", "san": "Nc6"},
                {"ply": 5, "actor": "human", "uci": "f1b5", "san": "Bb5"},
            ],
            "result": {"winner": "human"},
            "coach": {
                "status": "complete",
                "tactic_used": "Ruy Lopez pressure",
            },
        }
        path = app_module.GAME_LOG_DIR / "historic-position-memory.json"
        path.write_text(json.dumps(record), encoding="utf-8")
        return path

    def test_api_provider_models_remain_available(self):
        openai_response = self.client.get("/api/models?provider=openai")
        anthropic_response = self.client.get("/api/models?provider=anthropic")
        trained_response = self.client.get("/api/models?provider=trained")

        self.assertEqual(openai_response.status_code, 200)
        self.assertEqual(anthropic_response.status_code, 200)
        self.assertEqual(trained_response.status_code, 200)
        self.assertEqual(len(openai_response.get_json()["models"]), 5)
        self.assertEqual(len(anthropic_response.get_json()["models"]), 5)
        trained_models = trained_response.get_json()["models"]
        self.assertEqual(len(trained_models), 2)
        self.assertEqual(
            [model["display"] for model in trained_models],
            ["Trained AI Default", "Trust Value"],
        )
        self.assertTrue(trained_models[0]["is_default"])
        self.assertFalse(trained_models[1]["is_default"])
        self.assertTrue(trained_models[0]["available"])
        self.assertFalse(trained_models[1]["available"])
        self.assertTrue(trained_models[1]["coming_soon"])

    def test_local_profiles_are_immutable_selectable_and_persistent(self):
        create_response = self.client.post(
            "/api/players",
            json={"username": "Diego"},
        )
        self.assertEqual(create_response.status_code, 201)
        diego = create_response.get_json()["player"]
        self.assertEqual(diego["elo"], 0)

        duplicate = self.client.post(
            "/api/players",
            json={"username": "diego"},
        )
        self.assertEqual(duplicate.status_code, 400)

        select_response = self.client.post(
            "/api/players/select",
            json={"player_id": self.player["id"]},
        )
        self.assertEqual(select_response.status_code, 200)
        self.assertEqual(
            select_response.get_json()["player"]["username"],
            "Test Player",
        )

        profiles = self.client.get("/api/players").get_json()
        self.assertEqual(len(profiles["players"]), 2)
        self.assertEqual(profiles["current_player_id"], self.player["id"])
        self.assertEqual(profiles["authentication"], "local-no-password")

    def test_unplayed_legacy_profiles_migrate_from_1200_to_zero(self):
        legacy_store = {
            "schema_version": 1,
            "current_player_id": "legacy-new",
            "players": {
                "legacy-new": {
                    "id": "legacy-new",
                    "username": "Legacy New",
                    "normalized_username": "legacy new",
                    "created_at": "2026-07-01T00:00:00Z",
                    "last_played_at": None,
                    "elo": 1200,
                    "games": 0,
                    "wins": 0,
                    "losses": 0,
                    "draws": 0,
                    "rating_history": [],
                },
                "legacy-veteran": {
                    "id": "legacy-veteran",
                    "username": "Legacy Veteran",
                    "normalized_username": "legacy veteran",
                    "created_at": "2026-06-01T00:00:00Z",
                    "last_played_at": "2026-07-01T00:00:00Z",
                    "elo": 1240,
                    "games": 3,
                    "wins": 2,
                    "losses": 1,
                    "draws": 0,
                    "rating_history": [{"game_id": "historic"}],
                },
            },
            "opponents": {},
        }
        app_module.PLAYER_DATA_PATH.write_text(
            json.dumps(legacy_store),
            encoding="utf-8",
        )

        profiles = self.client.get("/api/players").get_json()["players"]
        ratings = {profile["id"]: profile["elo"] for profile in profiles}

        self.assertEqual(ratings["legacy-new"], 0)
        self.assertEqual(ratings["legacy-veteran"], 1240)

    def test_results_dashboard_aggregates_only_selected_players_completed_games(self):
        records = [
            {
                "game_id": "game-win",
                "started_at": "2026-07-20T20:00:00Z",
                "ended_at": "2026-07-20T20:20:00Z",
                "player": {"id": self.player["id"], "username": "Test Player"},
                "opponent": {
                    "provider": "codex",
                    "model_id": "gpt-test",
                    "display_name": "GPT Test",
                },
                "human_color": "white",
                "moves": [
                    {"actor": "human", "san": "e4"},
                    {"actor": "ai", "san": "e5"},
                ],
                "result": {"winner": "human"},
                "rating_update": {
                    "status": "complete",
                    "rating_before": 0,
                    "rating_after": 16,
                    "rating_delta": 16,
                },
                "coach": {
                    "status": "complete",
                    "one_line_insight": "A precise central win.",
                },
            },
            {
                "game_id": "game-loss",
                "started_at": "2026-07-21T20:00:00Z",
                "ended_at": "2026-07-21T20:30:00Z",
                "player": {"id": self.player["id"], "username": "Test Player"},
                "opponent": {
                    "provider": "openai",
                    "model_id": "gpt-5-mini",
                    "display_name": "GPT 5 Mini",
                },
                "human_color": "black",
                "moves": [
                    {"actor": "ai", "san": "e4"},
                    {"actor": "human", "san": "e5"},
                    {"actor": "ai", "san": "Nf3"},
                ],
                "result": {"winner": "ai"},
                "rating_update": {
                    "status": "complete",
                    "rating_before": 16,
                    "rating_after": 0,
                    "rating_delta": -16,
                },
                "coach": {"status": "pending"},
            },
            {
                "game_id": "game-unfinished",
                "started_at": "2026-07-22T20:00:00Z",
                "ended_at": None,
                "player": {"id": self.player["id"], "username": "Test Player"},
                "opponent": {"provider": "codex", "display_name": "GPT Test"},
                "moves": [],
                "result": {
                    "status": "incomplete",
                    "outcome": "incomplete",
                    "winner": None,
                    "loser": None,
                    "chess_result": "*",
                },
            },
            {
                "game_id": "other-player",
                "started_at": "2026-07-23T20:00:00Z",
                "ended_at": "2026-07-23T20:10:00Z",
                "player": {"id": "someone-else", "username": "Someone Else"},
                "opponent": {"provider": "codex", "display_name": "GPT Test"},
                "moves": [],
                "result": {"winner": "human"},
            },
        ]
        for record in records:
            path = app_module.GAME_LOG_DIR / f"{record['game_id']}.json"
            path.write_text(json.dumps(record), encoding="utf-8")

        response = self.client.get(f"/api/results?player_id={self.player['id']}")
        payload = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["summary"]["games"], 2)
        self.assertEqual(payload["summary"]["wins"], 1)
        self.assertEqual(payload["summary"]["losses"], 1)
        self.assertEqual(payload["summary"]["draws"], 0)
        self.assertEqual(payload["summary"]["win_rate"], 50.0)
        self.assertEqual(payload["summary"]["total_plies"], 5)
        self.assertEqual(
            [point["cumulative_wins"] for point in payload["timeline"]],
            [1, 1],
        )
        self.assertEqual(payload["source"]["unfinished_games"], 1)
        self.assertEqual(payload["source"]["files_scanned"], 4)
        self.assertEqual(payload["opponents"][0]["games"], 1)

    def test_index_offers_all_four_provider_choices(self):
        response = self.client.get("/")
        html = response.get_data(as_text=True)

        self.assertEqual(response.status_code, 200)
        self.assertIn("OpenAI API", html)
        self.assertIn("Anthropic API", html)
        self.assertIn("Codex SDK (ChatGPT subscription)", html)
        self.assertIn("Trained AI (local learning model)", html)
        self.assertIn("Learning model", html)
        self.assertIn("Classic", html)
        self.assertIn("Voxel 3D", html)
        self.assertIn('name="board-mode"', html)
        self.assertIn("Commentator", html)
        self.assertIn("commentator-speaker", html)
        self.assertIn('aria-label="Turn commentator on"', html)
        self.assertIn("Your color is randomized", html)
        self.assertIn("AI Model disconnected", html)
        self.assertIn('id="btn-open-results"', html)
        self.assertIn('id="results-chart"', html)
        self.assertIn("Private performance record", html)
        self.assertNotIn("Local arena", html)

    @patch.object(app_module, "list_codex_models", return_value=CODEX_MODELS)
    def test_codex_models_are_discovered_from_sdk(self, list_models):
        response = self.client.get("/api/models?provider=codex")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["models"], CODEX_MODELS)
        list_models.assert_called_once_with()

    @patch.object(app_module, "call_codex_chess_move", return_value=("e7e5", "Controls the center."))
    @patch.object(app_module, "list_codex_models", return_value=CODEX_MODELS)
    @patch.object(app_module.secrets, "choice", return_value="white")
    def test_codex_game_routes_moves_through_sdk(self, _color, _list_models, call_move):
        start_response = self.client.post(
            "/api/start-game",
            json={"ai_provider": "codex", "ai_model": "gpt-test"},
        )
        self.assertEqual(start_response.status_code, 200)

        human_response = self.client.post("/api/human-move", json={"move": "e2e4"})
        self.assertEqual(human_response.status_code, 200)

        ai_response = self.client.post("/api/ai-move")
        self.assertEqual(ai_response.status_code, 200)
        self.assertEqual(ai_response.get_json()["move"], "e7e5")
        self.assertEqual(call_move.call_args.args[1], "gpt-test")

    @patch.object(app_module, "call_codex_chess_move", return_value=("e7e5", "Tests the center."))
    @patch.object(app_module, "list_codex_models", return_value=CODEX_MODELS)
    @patch.object(app_module.secrets, "choice", return_value="white")
    def test_codex_opponent_does_not_receive_prior_coach_history(
        self,
        _color,
        _list_models,
        call_move,
    ):
        self.write_coached_game()
        start_response = self.client.post(
            "/api/start-game",
            json={"ai_provider": "codex", "ai_model": "gpt-test"},
        )
        self.assertEqual(start_response.status_code, 200)

        self.client.post("/api/human-move", json={"move": "e2e4"})
        self.client.post("/api/ai-move")
        prompt = call_move.call_args.args[0]

        self.assertNotIn("PRIOR CODEX COACH SCOUTING REPORT", prompt)
        self.assertNotIn("Kingside initiative", prompt)
        self.assertNotIn("The early g-pawn push opened your king.", prompt)

    @patch.object(app_module.secrets, "choice", return_value="black")
    def test_color_draw_can_assign_black_and_rotates_roles(self, _color):
        response = self.client.post(
            "/api/start-game",
            json={"ai_provider": "openai", "ai_model": "gpt-5-mini"},
        )
        state = response.get_json()["game_state"]

        self.assertEqual(response.status_code, 200)
        self.assertEqual(state["human_color"], "black")
        self.assertEqual(state["ai_color"], "white")
        self.assertEqual(state["current_turn"], "white")
        self.assertEqual(
            self.client.post("/api/human-move", json={"move": "e7e5"}).status_code,
            400,
        )

    @patch.object(app_module, "call_openai_chess_move", return_value=("e2e4", "Claims the center."))
    @patch.object(app_module.secrets, "choice", return_value="black")
    def test_ai_can_open_as_white(self, _color, call_move):
        self.write_coached_game()
        self.client.post(
            "/api/start-game",
            json={"ai_provider": "openai", "ai_model": "gpt-5-mini"},
        )

        ai_response = self.client.post("/api/ai-move")

        self.assertEqual(ai_response.status_code, 200)
        self.assertEqual(ai_response.get_json()["move"], "e2e4")
        self.assertEqual(ai_response.get_json()["game_state"]["current_turn"], "black")
        prompt = call_move.call_args.args[0]
        self.assertIn("You are playing White", prompt)
        self.assertIn("It is your turn (White)", prompt)
        self.assertNotIn("PRIOR CODEX COACH SCOUTING REPORT", prompt)

        human_response = self.client.post("/api/human-move", json={"move": "e7e5"})
        self.assertEqual(human_response.status_code, 200)
        self.assertEqual(human_response.get_json()["game_state"]["current_turn"], "white")

    @patch.object(app_module.secrets, "choice", return_value="white")
    def test_capture_response_describes_defeated_piece(self, _color):
        self.client.post(
            "/api/start-game",
            json={"ai_provider": "openai", "ai_model": "gpt-5-mini"},
        )
        board = chess.Board("8/8/8/3p4/4P3/8/8/4K2k w - - 0 1")
        app_module.GAME_STATE["board"] = board
        app_module.GAME_STATE["fen"] = board.fen()
        app_module.GAME_STATE["current_turn"] = "white"

        response = self.client.post("/api/human-move", json={"move": "e4d5"})
        capture = response.get_json()["capture"]

        self.assertEqual(response.status_code, 200)
        self.assertEqual(capture["square"], "d5")
        self.assertEqual(capture["piece"], "p")
        self.assertEqual(capture["attacker"], "P")

    def test_prompt_supports_either_ai_color(self):
        prompt = generate_chess_prompt("board", [], ["e2e4"], ai_color="white")
        self.assertIn("You are playing White", prompt)
        self.assertIn("The human is playing Black", prompt)

    def test_grandmaster_coach_receives_complete_game_json(self):
        record = {
            "game_id": "game-test",
            "human_color": "black",
            "opponent": {
                "provider": "codex",
                "model_id": "gpt-test",
                "display_name": "GPT Test",
            },
            "moves": [
                {
                    "ply": 1,
                    "played_at": "2026-07-27T22:00:00Z",
                    "actor": "ai",
                    "uci": "e2e4",
                    "san": "e4",
                    "fen_after": "test-fen",
                    "capture": None,
                }
            ],
            "final_fen": "final-test-fen",
            "pgn": "1. e4 e5 2. Nf3",
            "result": {
                "winner": "human",
                "description": "Checkmate! You win!",
                "chess_result": "0-1",
            },
        }

        prompt = generate_codex_coach_prompt(record)

        self.assertIn("world-class chess grandmaster", CODEX_COACH_INSTRUCTIONS)
        self.assertIn('"human_color":"black"', prompt)
        self.assertIn('"display_name":"GPT Test"', prompt)
        self.assertIn('"winner":"human"', prompt)
        self.assertIn('"san":"e4"', prompt)
        self.assertIn('"fen_after":"test-fen"', prompt)
        self.assertIn('"pgn":"1. e4 e5 2. Nf3"', prompt)

    @patch.object(app_module, "call_openai_chess_move")
    @patch.object(app_module, "call_anthropic_chess_move")
    @patch.object(app_module, "call_codex_chess_move")
    @patch.object(app_module.secrets, "choice", return_value="white")
    def test_trained_ai_plays_locally_without_any_inference(
        self,
        _color,
        codex_move,
        anthropic_move,
        openai_move,
    ):
        start = self.client.post(
            "/api/start-game",
            json={"ai_provider": "trained", "ai_model": "trained-local"},
        )
        self.assertEqual(start.status_code, 200)
        self.assertEqual(
            start.get_json()["game_state"]["trained_model_summary"]["games_processed"],
            0,
        )
        self.assertEqual(
            start.get_json()["game_state"]["trained_ai_win_prediction"]["win_probability"],
            0.5,
        )
        self.assertEqual(
            len(start.get_json()["game_state"]["trained_ai_prediction_history"]),
            1,
        )

        human_response = self.client.post(
            "/api/human-move",
            json={"move": "e2e4"},
        )
        human_state = human_response.get_json()["game_state"]
        self.assertEqual(
            len(human_state["trained_ai_prediction_history"]),
            2,
        )
        persisted = json.loads(
            app_module.game_log_path(human_state["game_id"]).read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(len(persisted["trained_ai_predictions"]), 2)
        response = self.client.post("/api/ai-move")
        payload = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["success"])
        self.assertIn("No SDK or API call", payload["reasoning"])
        self.assertEqual(
            payload["game_state"]["trained_ai_last_decision"]["match_type"],
            "fallback",
        )
        openai_move.assert_not_called()
        anthropic_move.assert_not_called()
        codex_move.assert_not_called()

    @patch.object(app_module.secrets, "choice", return_value="white")
    def test_trust_value_is_visible_but_cannot_start_a_game(self, _color):
        start = self.client.post(
            "/api/start-game",
            json={
                "ai_provider": "trained",
                "ai_model": "trained-trust-value",
            },
        )
        self.assertEqual(start.status_code, 400)
        self.assertEqual(
            start.get_json()["error"],
            "Trust Value is coming soon.",
        )

    def test_trained_model_learns_only_ai_moves_and_replays_exact_position(self):
        record = {
            "game_id": "labeled-game",
            "moves": [
                {"ply": 1, "actor": "human", "uci": "e2e4"},
                {"ply": 2, "actor": "ai", "uci": "e7e5"},
                {"ply": 3, "actor": "human", "uci": "g1f3"},
                {"ply": 4, "actor": "ai", "uci": "b8c6"},
            ],
            "result": {"winner": "ai"},
            "trained_ai_analysis": {
                "status": "complete",
                "move_labels": [
                    {
                        "ply": 2,
                        "strategy": "center_control",
                        "evidence": "...e5 contests the center.",
                    },
                    {
                        "ply": 4,
                        "strategy": "piece_development",
                        "evidence": "...Nc6 develops toward the center.",
                    },
                ],
            },
        }
        log_path = app_module.GAME_LOG_DIR / "labeled-game.json"
        log_path.write_text(json.dumps(record), encoding="utf-8")

        model = rebuild_trained_model(
            app_module.GAME_LOG_DIR,
            app_module.TRAINED_AI_MODEL_PATH,
        )

        self.assertEqual(model["games_processed"], 1)
        self.assertEqual(model["positions_seen"], 2)
        self.assertTrue(all(sample["ply"] in (2, 4) for sample in model["samples"]))

        board = chess.Board()
        board.push_uci("e2e4")
        move, reasoning, metadata = choose_trained_move(
            board,
            app_module.TRAINED_AI_MODEL_PATH,
        )
        self.assertEqual(move, "e7e5")
        self.assertEqual(metadata["match_type"], "exact")
        self.assertEqual(metadata["strategy"], "center_control")
        self.assertIn("exact position", reasoning)

    def test_trained_model_learns_unlabeled_games_and_explains_generalization(self):
        record = {
            "game_id": "unlabeled-complete-game",
            "moves": [
                {"ply": 1, "actor": "human", "uci": "e2e4"},
                {"ply": 2, "actor": "ai", "uci": "e7e5"},
                {"ply": 3, "actor": "human", "uci": "g1f3"},
                {"ply": 4, "actor": "ai", "uci": "b8c6"},
            ],
            "result": {"winner": "human"},
            "trained_ai_analysis": {"status": "pending"},
        }
        log_path = app_module.GAME_LOG_DIR / "unlabeled-complete-game.json"
        log_path.write_text(json.dumps(record), encoding="utf-8")

        model = rebuild_trained_model(
            app_module.GAME_LOG_DIR,
            app_module.TRAINED_AI_MODEL_PATH,
        )

        self.assertEqual(model["schema_version"], 3)
        self.assertEqual(model["games_processed"], 1)
        self.assertEqual(model["positions_seen"], 2)
        self.assertEqual(model["value_positions_seen"], 5)
        self.assertEqual(model["game_outcomes"]["losses"], 1)
        self.assertEqual(
            model["linear_policy"]["type"],
            "outcome_weighted_linear_policy",
        )
        self.assertTrue(all(
            sample["strategy_source"] == "local"
            for sample in model["samples"]
        ))
        self.assertEqual(
            model["value_policy"]["type"],
            "ai_win_probability_linear_value_model",
        )

        unseen_board = chess.Board()
        unseen_board.push_uci("d2d4")
        move, reasoning, metadata = choose_trained_move(
            unseen_board,
            app_module.TRAINED_AI_MODEL_PATH,
        )

        self.assertIn(chess.Move.from_uci(move), unseen_board.legal_moves)
        self.assertEqual(metadata["match_type"], "linear")
        self.assertEqual(metadata["games_processed"], 1)
        self.assertEqual(metadata["positions_seen"], 2)
        self.assertEqual(len(metadata["decision_path"]), 3)
        self.assertGreater(len(metadata["candidate_moves"]), 0)
        self.assertIn("linear policy", reasoning)

        forecast = predict_trained_win_probability(
            unseen_board,
            chess.BLACK,
            app_module.TRAINED_AI_MODEL_PATH,
        )
        self.assertEqual(forecast["source"], "learned_value_model")
        self.assertGreaterEqual(forecast["win_probability"], 0.02)
        self.assertLessEqual(forecast["win_probability"], 0.98)
        self.assertEqual(forecast["positions_seen"], 5)
        self.assertTrue(forecast["factors"])

    @patch.object(app_module.secrets, "choice", return_value="white")
    def test_completed_game_immediately_refreshes_trained_model(self, _color):
        state = app_module.init_game_state(
            ai_provider="openai",
            ai_model="gpt-5-mini",
            player_id=self.player["id"],
        )
        for actor, move_uci in (
            ("human", "f2f3"),
            ("ai", "e7e5"),
            ("human", "g2g4"),
            ("ai", "d8h4"),
        ):
            board = state["board"]
            move = chess.Move.from_uci(move_uci)
            san = board.san(move)
            board.push(move)
            state["fen"] = board.fen()
            state["move_history"].append(move_uci)
            state["move_history_san"].append(san)
            state["current_turn"] = "white" if board.turn == chess.WHITE else "black"
            app_module.append_move_record(state, move_uci, san, actor, None)
            app_module.finalize_game(state, actor)

        app_module.persist_game_and_refresh_training(state)
        trained_model = json.loads(
            app_module.TRAINED_AI_MODEL_PATH.read_text(encoding="utf-8")
        )

        self.assertTrue(state["game_over"])
        self.assertEqual(trained_model["games_processed"], 1)
        self.assertEqual(trained_model["positions_seen"], 2)
        self.assertEqual(trained_model["game_outcomes"]["wins"], 1)
        self.assertEqual(state["trained_model_summary"]["positions_seen"], 2)

    @patch.object(app_module.secrets, "choice", return_value="white")
    def test_game_json_is_created_and_updated_after_every_move(self, _color):
        start = self.client.post(
            "/api/start-game",
            json={"ai_provider": "openai", "ai_model": "gpt-5-mini"},
        ).get_json()["game_state"]
        log_path = app_module.game_log_path(start["game_id"])

        self.assertTrue(log_path.exists())
        initial_record = json.loads(log_path.read_text(encoding="utf-8"))
        self.assertEqual(initial_record["started_at"], start["started_at"])
        self.assertEqual(initial_record["opponent"]["display_name"], "GPT 5 Mini")
        self.assertEqual(initial_record["moves"], [])
        self.assertEqual(initial_record["schema_version"], 2)
        self.assertEqual(initial_record["result"]["status"], "incomplete")
        self.assertEqual(initial_record["result"]["outcome"], "incomplete")
        self.assertIsNone(initial_record["result"]["winner"])
        self.assertIsNone(initial_record["result"]["loser"])
        self.assertEqual(initial_record["result"]["chess_result"], "*")
        self.assertIsNone(initial_record["ended_at"])
        self.assertTrue(initial_record["last_updated_at"].endswith("Z"))

        response = self.client.post("/api/human-move", json={"move": "e2e4"})
        self.assertEqual(response.status_code, 200)
        record = json.loads(log_path.read_text(encoding="utf-8"))
        move = record["moves"][0]
        self.assertEqual(move["ply"], 1)
        self.assertEqual(move["actor"], "human")
        self.assertEqual(move["uci"], "e2e4")
        self.assertEqual(move["san"], "e4")
        self.assertTrue(move["played_at"].endswith("Z"))
        self.assertIn("fen_after", move)
        self.assertEqual(record["result"]["status"], "incomplete")
        self.assertEqual(record["result"]["outcome"], "incomplete")

    def test_legacy_unfinished_json_is_migrated_to_explicit_incomplete(self):
        legacy_path = app_module.GAME_LOG_DIR / "legacy-unfinished.json"
        legacy_path.write_text(
            json.dumps({
                "schema_version": 1,
                "game_id": "legacy-unfinished",
                "started_at": "2026-07-27T20:00:00Z",
                "ended_at": None,
                "moves": [{"ply": 1, "actor": "human", "uci": "e2e4"}],
                "result": None,
            }),
            encoding="utf-8",
        )

        response = self.client.get("/")
        migrated = json.loads(legacy_path.read_text(encoding="utf-8"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(migrated["schema_version"], 2)
        self.assertEqual(migrated["result"]["status"], "incomplete")
        self.assertEqual(migrated["result"]["outcome"], "incomplete")
        self.assertEqual(migrated["result"]["chess_result"], "*")
        self.assertEqual(
            migrated["last_updated_at"],
            "2026-07-27T20:00:00Z",
        )

    def test_history_hint_recalls_same_players_similar_position(self):
        self.write_position_memory_game()
        state = app_module.init_game_state(
            ai_provider="openai",
            ai_model="gpt-5-mini",
            human_color="white",
        )
        for actor, move_uci in [
            ("human", "e2e4"),
            ("ai", "e7e5"),
            ("human", "g1f3"),
            ("ai", "b8c6"),
        ]:
            board = state["board"]
            move = chess.Move.from_uci(move_uci)
            san = board.san(move)
            board.push(move)
            state["fen"] = board.fen()
            state["move_history"].append(move_uci)
            state["move_history_san"].append(san)
            state["current_turn"] = "white" if board.turn == chess.WHITE else "black"
            app_module.append_move_record(state, move_uci, san, actor, None)
        app_module.GAME_STATE = state

        response = self.client.get("/api/history-hint")
        hint = response.get_json()["hint"]

        self.assertEqual(response.status_code, 200)
        self.assertEqual(hint["strategy"], "Ruy Lopez pressure")
        self.assertEqual(hint["move"], "Bb5")
        self.assertEqual(hint["opponent"], "GPT Test")
        self.assertEqual(hint["result"], "human")
        self.assertEqual(hint["similarity"], 1.0)

    def test_history_hint_never_reads_another_players_games(self):
        self.write_position_memory_game(player_id="someone-else")
        state = app_module.init_game_state(
            ai_provider="openai",
            ai_model="gpt-5-mini",
            human_color="white",
        )
        for actor, move_uci in [
            ("human", "e2e4"),
            ("ai", "e7e5"),
            ("human", "g1f3"),
            ("ai", "b8c6"),
        ]:
            board = state["board"]
            move = chess.Move.from_uci(move_uci)
            san = board.san(move)
            board.push(move)
            state["fen"] = board.fen()
            state["move_history"].append(move_uci)
            state["move_history_san"].append(san)
            state["current_turn"] = "white" if board.turn == chess.WHITE else "black"
            app_module.append_move_record(state, move_uci, san, actor, None)
        app_module.GAME_STATE = state

        response = self.client.get("/api/history-hint")

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.get_json()["hint"])

    def test_coach_is_only_available_after_game_ends(self):
        state = app_module.init_game_state(
            ai_provider="openai",
            ai_model="gpt-5-mini",
            human_color="white",
        )
        app_module.GAME_STATE = state
        app_module.persist_game_record(state)

        response = self.client.post("/api/game-coach")

        self.assertEqual(response.status_code, 409)
        self.assertIn("after the game ends", response.get_json()["error"])

    @patch.object(
        app_module,
        "call_codex_game_coach",
        return_value={
            "tactics": [
                {
                    "name": "Kingside initiative",
                    "description": "You built pressure toward the king.",
                    "evidence": "The g-pawn advance committed play to that wing.",
                },
                {
                    "name": "Central control",
                    "description": "You contested key central squares.",
                    "evidence": "The opening pawn structure influenced e4 and e5.",
                },
                {
                    "name": "Development tempo",
                    "description": "You tried to bring pieces into play quickly.",
                    "evidence": "The early sequence prioritized active intentions.",
                },
                {
                    "name": "King safety",
                    "description": "You had to balance attack with king protection.",
                    "evidence": "The exposed diagonal allowed ...Qh4#.",
                },
            ],
            "used_tactic_index": 0,
            "one_line_insight": "Against GPT 5 Mini, you attacked boldly but opened your own king too quickly.",
            "what_went_wrong": [
                "2.g4 weakened the e1-h4 diagonal and allowed ...Qh4#.",
                "You launched flank pawns before creating a safe square for your king.",
            ],
            "best_improvement": "Before every attacking pawn move, scan all checks against your king.",
            "ai_strategy_analysis": {
                "overall_strategy": "forcing_mate",
                "summary": "The AI used a direct mating attack.",
                "move_labels": [
                    {
                        "ply": 2,
                        "strategy": "center_control",
                        "evidence": "...e5 opened the queen's diagonal.",
                    },
                    {
                        "ply": 4,
                        "strategy": "forcing_mate",
                        "evidence": "...Qh4 delivered checkmate.",
                    },
                ],
            },
        },
    )
    def test_completed_game_gets_cached_codex_coach_report(self, coach_call):
        state = app_module.init_game_state(
            ai_provider="openai",
            ai_model="gpt-5-mini",
            human_color="white",
        )
        for actor, move_uci in [
            ("human", "f2f3"),
            ("ai", "e7e5"),
            ("human", "g2g4"),
            ("ai", "d8h4"),
        ]:
            board = state["board"]
            move = chess.Move.from_uci(move_uci)
            san = board.san(move)
            board.push(move)
            state["fen"] = board.fen()
            state["move_history"].append(move_uci)
            state["move_history_san"].append(san)
            state["current_turn"] = "white" if board.turn == chess.WHITE else "black"
            app_module.append_move_record(state, move_uci, san, actor, None)
        app_module.finalize_game(state, "ai")
        self.assertEqual(state["rating_update"]["rating_before"], 0)
        self.assertEqual(state["rating_update"]["rating_after"], 0)
        self.assertEqual(state["rating_update"]["rating_delta"], 0)
        app_module.finalize_game(state, "ai")
        self.assertEqual(state["rating_update"]["rating_after"], 0)
        app_module.GAME_STATE = state
        app_module.persist_game_record(state)

        response = self.client.post("/api/game-coach")
        payload = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["coach"]["opponent_model"], "GPT 5 Mini")
        self.assertEqual(len(payload["coach"]["tactics"]), 4)
        self.assertEqual(
            [item["used"] for item in payload["coach"]["tactics"]],
            [True, False, False, False],
        )
        self.assertEqual(payload["coach"]["tactic_used"], "Kingside initiative")
        self.assertEqual(len(payload["coach"]["what_went_wrong"]), 2)
        coach_call.assert_called_once()

        log_path = app_module.game_log_path(state["game_id"])
        record = json.loads(log_path.read_text(encoding="utf-8"))
        self.assertEqual(record["result"]["status"], "complete")
        self.assertEqual(record["result"]["outcome"], "win")
        self.assertEqual(record["result"]["winner"], "ai")
        self.assertEqual(record["result"]["loser"], "human")
        self.assertEqual(record["result"]["chess_result"], "0-1")
        self.assertIsNotNone(record["ended_at"])
        self.assertEqual(record["coach"]["status"], "complete")
        self.assertEqual(record["trained_ai_analysis"]["status"], "complete")
        self.assertEqual(record["trained_ai_analysis"]["overall_strategy"], "forcing_mate")
        self.assertEqual(record["player"]["username"], "Test Player")
        self.assertEqual(record["rating_update"]["rating_after"], 0)
        trained_model = json.loads(
            app_module.TRAINED_AI_MODEL_PATH.read_text(encoding="utf-8")
        )
        self.assertEqual(trained_model["games_processed"], 1)
        self.assertEqual(trained_model["positions_seen"], 2)

        cached_response = self.client.post("/api/game-coach")
        self.assertEqual(cached_response.status_code, 200)
        coach_call.assert_called_once()
        player = app_module.get_player(
            app_module.PLAYER_DATA_PATH,
            self.player["id"],
        )
        self.assertEqual(player["elo"], 0)
        self.assertEqual(player["games"], 1)


class GameControlTests(KingsideTestCase):
    """Resignation, draw claims, and takebacks."""

    def start_trained_game(self):
        with patch.object(app_module.secrets, "choice", return_value="white"):
            response = self.client.post(
                "/api/start-game",
                json={"ai_provider": "trained", "ai_model": "trained-local"},
            )
        self.assertEqual(response.status_code, 200)
        return response.get_json()["game_state"]

    def test_resigning_loses_the_game_and_scores_it(self):
        self.start_trained_game()
        self.client.post("/api/human-move", json={"move": "e2e4"})

        response = self.client.post("/api/resign")
        self.assertEqual(response.status_code, 200)
        state = response.get_json()["game_state"]
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner"], "ai")
        self.assertIn("resigned", state["game_result"].lower())

        # A resignation is a completed game: it is rated and logged as such.
        self.assertEqual(state["rating_update"]["status"], "complete")
        player = app_module.get_player(
            app_module.PLAYER_DATA_PATH, self.player["id"]
        )
        self.assertEqual(player["games"], 1)
        self.assertEqual(player["losses"], 1)

        record = json.loads(
            next(Path(self.log_directory.name).glob("*.json")).read_text(
                encoding="utf-8"
            )
        )
        self.assertNotEqual(record.get("status"), "incomplete")

    def test_resigning_twice_does_not_double_count(self):
        self.start_trained_game()
        self.client.post("/api/resign")
        second = self.client.post("/api/resign")
        self.assertEqual(second.status_code, 400)
        player = app_module.get_player(
            app_module.PLAYER_DATA_PATH, self.player["id"]
        )
        self.assertEqual(player["games"], 1)

    def test_resign_requires_a_game_in_progress(self):
        app_module.GAME_STATE = {}
        self.assertEqual(self.client.post("/api/resign").status_code, 400)

    def test_draw_cannot_be_claimed_from_the_opening(self):
        self.start_trained_game()
        response = self.client.post("/api/claim-draw")
        self.assertEqual(response.status_code, 400)
        self.assertIn("does not allow", response.get_json()["error"])

    def test_draw_can_be_claimed_once_the_position_repeats(self):
        state = self.start_trained_game()
        self.assertFalse(state["can_claim_draw"])

        # Shuffle both knights out and back until the start position repeats.
        app_module.GAME_STATE["board"] = chess.Board()
        board = app_module.GAME_STATE["board"]
        for move in ["g1f3", "g8f6", "f3g1", "f6g8"] * 2:
            board.push(chess.Move.from_uci(move))
        app_module.GAME_STATE["fen"] = board.fen()

        response = self.client.post("/api/claim-draw")
        self.assertEqual(response.status_code, 200)
        drawn = response.get_json()["game_state"]
        self.assertTrue(drawn["game_over"])
        self.assertEqual(drawn["winner"], "draw")
        player = app_module.get_player(
            app_module.PLAYER_DATA_PATH, self.player["id"]
        )
        self.assertEqual(player["draws"], 1)

    def test_takeback_retracts_your_move_and_the_ai_reply(self):
        self.start_trained_game()
        after_move = self.client.post(
            "/api/human-move", json={"move": "e2e4"}
        ).get_json()["game_state"]
        self.assertEqual(len(after_move["move_history"]), 1)

        ai_state = self.client.post("/api/ai-move").get_json()["game_state"]
        self.assertEqual(len(ai_state["move_history"]), 2)
        self.assertTrue(ai_state["can_takeback"])

        response = self.client.post("/api/takeback")
        self.assertEqual(response.status_code, 200)
        state = response.get_json()["game_state"]

        # Both plies are gone and it is the human's turn on the start position.
        self.assertEqual(state["move_history"], [])
        self.assertEqual(state["move_history_san"], [])
        self.assertEqual(state["move_records"], [])
        self.assertEqual(state["current_turn"], state["human_color"])
        self.assertEqual(state["fen"], chess.Board().fen())
        self.assertFalse(state["can_takeback"])

    def test_takeback_is_refused_when_you_have_not_moved(self):
        self.start_trained_game()
        response = self.client.post("/api/takeback")
        self.assertEqual(response.status_code, 400)
        self.assertIn("no move of yours", response.get_json()["error"])

    def test_takeback_is_refused_after_the_game_ends(self):
        self.start_trained_game()
        self.client.post("/api/human-move", json={"move": "e2e4"})
        self.client.post("/api/resign")
        self.assertEqual(self.client.post("/api/takeback").status_code, 400)

    def test_takeback_then_replay_keeps_the_history_consistent(self):
        self.start_trained_game()
        self.client.post("/api/human-move", json={"move": "e2e4"})
        self.client.post("/api/ai-move")
        self.client.post("/api/takeback")

        replayed = self.client.post(
            "/api/human-move", json={"move": "d2d4"}
        ).get_json()["game_state"]
        self.assertEqual(replayed["move_history"], ["d2d4"])
        self.assertEqual(replayed["move_history_san"], ["d4"])
        self.assertEqual(len(replayed["move_records"]), 1)
        self.assertEqual(replayed["move_records"][0]["ply"], 1)


if __name__ == "__main__":
    unittest.main()
