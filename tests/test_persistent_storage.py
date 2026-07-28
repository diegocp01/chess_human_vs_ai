import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from persistent_storage import (
    DATA_DIR_ENV,
    default_data_root,
    legacy_project_roots,
    migrate_legacy_storage,
    storage_paths,
)


class PersistentStorageTests(unittest.TestCase):
    def test_data_root_environment_override_is_expanded_and_resolved(self):
        with tempfile.TemporaryDirectory() as directory:
            configured = Path(directory) / "forever"
            with patch.dict(os.environ, {DATA_DIR_ENV: str(configured)}):
                self.assertEqual(default_data_root(), configured.resolve())

    def test_linked_worktree_discovers_main_checkout(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            main_checkout = root / "main"
            worktree = root / "feature"
            git_dir = main_checkout / ".git" / "worktrees" / "feature"
            git_dir.mkdir(parents=True)
            worktree.mkdir()
            (worktree / ".git").write_text(
                f"gitdir: {git_dir}\n",
                encoding="utf-8",
            )

            self.assertEqual(
                legacy_project_roots(worktree),
                [worktree.resolve(), main_checkout.resolve()],
            )

    def test_migration_keeps_profiles_history_and_model_across_worktrees(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            main_checkout = root / "main"
            worktree = root / "feature"
            data_root = root / "permanent"
            git_dir = main_checkout / ".git" / "worktrees" / "feature"
            git_dir.mkdir(parents=True)
            worktree.mkdir()
            (worktree / ".git").write_text(
                f"gitdir: {git_dir}\n",
                encoding="utf-8",
            )

            profiles_path = main_checkout / "player_data" / "profiles.json"
            profiles_path.parent.mkdir()
            profiles_path.write_text(
                json.dumps(
                    {
                        "schema_version": 2,
                        "current_player_id": "diego",
                        "players": {
                            "diego": {
                                "id": "diego",
                                "username": "Diego C",
                                "normalized_username": "diego c",
                                "created_at": "2026-07-27T00:00:00Z",
                                "last_played_at": None,
                                "elo": 0,
                                "games": 0,
                                "wins": 0,
                                "losses": 0,
                                "draws": 0,
                                "rating_history": [],
                            }
                        },
                        "opponents": {},
                    }
                ),
                encoding="utf-8",
            )

            log_dir = main_checkout / "game_logs"
            log_dir.mkdir()
            (log_dir / "game-one.json").write_text(
                '{"game_id": "game-one"}\n',
                encoding="utf-8",
            )

            model_path = main_checkout / "trained_ai" / "model.json"
            model_path.parent.mkdir()
            model_path.write_text(
                '{"games_processed": 1}\n',
                encoding="utf-8",
            )

            summary = migrate_legacy_storage(worktree, data_root)
            paths = storage_paths(data_root)
            saved_profiles = json.loads(
                paths["player_data_path"].read_text(encoding="utf-8")
            )

            self.assertEqual(summary["profiles_imported"], 1)
            self.assertEqual(summary["game_logs_imported"], 1)
            self.assertTrue(summary["trained_model_imported"])
            self.assertEqual(
                saved_profiles["players"]["diego"]["username"],
                "Diego C",
            )
            self.assertEqual(saved_profiles["current_player_id"], "diego")
            self.assertTrue(
                (paths["game_log_dir"] / "game-one.json").exists()
            )
            self.assertEqual(
                json.loads(
                    paths["trained_model_path"].read_text(encoding="utf-8")
                )["games_processed"],
                1,
            )

            second_summary = migrate_legacy_storage(worktree, data_root)
            self.assertEqual(second_summary["profiles_imported"], 0)
            self.assertEqual(second_summary["game_logs_imported"], 0)
            self.assertFalse(second_summary["trained_model_imported"])


if __name__ == "__main__":
    unittest.main()
