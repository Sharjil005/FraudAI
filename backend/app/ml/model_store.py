"""Model training, persistence and inference.

Two lightweight models are trained from the bundled corpora on first use and
cached on disk with joblib:

* ``url_rf``      – RandomForestClassifier over 28 lexical URL features.
* ``message_tfidf`` – TF-IDF (word + char n-grams) → LogisticRegression.

Every entry point degrades gracefully: if scikit-learn is unavailable or a
model fails to train, ``predict_*`` returns ``None`` and callers fall back to
the deterministic heuristic engines, so the platform never hard-fails.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging_config import get_logger
from app.ml.datasets import build_message_dataset, build_url_dataset
from app.ml.features import FEATURE_NAMES, extract_url_features
from app.models.scan import Scan
from app.models.user import User

logger = get_logger(__name__)

try:  # pragma: no cover - exercised implicitly by the environment
    import joblib
    import numpy as np
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import accuracy_score
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import Pipeline

    SKLEARN_AVAILABLE = True
except Exception as exc:  # pragma: no cover
    logger.warning("scikit-learn unavailable (%s); heuristic-only mode active.", exc)
    SKLEARN_AVAILABLE = False

URL_MODEL_FILE = "url_random_forest.joblib"
MESSAGE_MODEL_FILE = "message_tfidf_logreg.joblib"
MODEL_FORMAT_VERSION = 3

_lock = threading.Lock()


@dataclass(slots=True)
class ModelBundle:
    """A trained estimator plus the metrics captured at training time."""

    estimator: Any
    metadata: dict[str, Any]


class ModelRegistry:
    """Lazy, thread-safe, disk-cached registry for the two models."""

    def __init__(self, model_dir: Path | None = None) -> None:
        self.model_dir = model_dir or settings.model_path
        self._url: ModelBundle | None = None
        self._message: ModelBundle | None = None
        self._url_failed = False
        self._message_failed = False

    # ---- URL model ------------------------------------------------------
    def url_model(self) -> ModelBundle | None:
        if self._url is not None or self._url_failed or not SKLEARN_AVAILABLE:
            return self._url
        with _lock:
            if self._url is not None or self._url_failed:
                return self._url
            try:
                self._url = self._load_or_train(
                    URL_MODEL_FILE, self._train_url_model, "URL RandomForest"
                )
            except Exception as exc:  # pragma: no cover
                logger.error("URL model unavailable: %s", exc)
                self._url_failed = True
        return self._url

    def message_model(self) -> ModelBundle | None:
        if self._message is not None or self._message_failed or not SKLEARN_AVAILABLE:
            return self._message
        with _lock:
            if self._message is not None or self._message_failed:
                return self._message
            try:
                self._message = self._load_or_train(
                    MESSAGE_MODEL_FILE, self._train_message_model, "Message TF-IDF"
                )
            except Exception as exc:  # pragma: no cover
                logger.error("Message model unavailable: %s", exc)
                self._message_failed = True
        return self._message

    # ---- Persistence ----------------------------------------------------
    def _load_or_train(self, filename: str, trainer, label: str) -> ModelBundle:
        path = self.model_dir / filename
        if path.exists():
            try:
                payload = joblib.load(path)
                if payload.get("version") == MODEL_FORMAT_VERSION:
                    logger.info("Loaded cached %s model from %s", label, path.name)
                    return ModelBundle(payload["estimator"], payload["metadata"])
                logger.info("Cached %s model is stale; retraining.", label)
            except Exception as exc:
                logger.warning("Could not load cached %s model (%s); retraining.", label, exc)

        bundle = trainer()
        try:
            self.model_dir.mkdir(parents=True, exist_ok=True)
            joblib.dump(
                {
                    "version": MODEL_FORMAT_VERSION,
                    "estimator": bundle.estimator,
                    "metadata": bundle.metadata,
                },
                path,
            )
            logger.info(
                "Trained %s model (accuracy=%.3f) and cached to %s",
                label,
                bundle.metadata.get("accuracy", 0.0),
                path.name,
            )
        except Exception as exc:  # pragma: no cover
            logger.warning("Trained %s model but could not persist it: %s", label, exc)
        return bundle

    # ---- Training -------------------------------------------------------
    @staticmethod
    def _label_to_target(label: str) -> int | None:
        normalized = label.strip().upper()
        safe_labels = {
            "SAFE",
            "BENIGN",
            "LEGIT",
            "LEGITIMATE",
            "NOT_SUSPICIOUS",
            "NO_THREAT",
            "NORMAL",
            "FALSE_POSITIVE",
        }
        suspicious_labels = {
            "SUSPICIOUS",
            "PHISHING",
            "SCAM",
            "MALICIOUS",
            "FRAUD",
            "THREAT",
            "HIGH_RISK",
            "RISKY",
        }

        if normalized in safe_labels:
            return 0
        if normalized in suspicious_labels:
            return 1
        return None

    @staticmethod
    def _train_url_model_from_samples(urls: list[str], labels: list[int]) -> ModelBundle:
        if not urls:
            raise ValueError("No URL training data available.")

        matrix = np.array([extract_url_features(u).to_vector() for u in urls], dtype=float)
        target = np.array(labels, dtype=int)

        x_train, x_test, y_train, y_test = train_test_split(
            matrix, target, test_size=0.2, random_state=42, stratify=target
        )
        clf = RandomForestClassifier(
            n_estimators=220,
            max_depth=14,
            min_samples_leaf=2,
            class_weight="balanced",
            n_jobs=-1,
            random_state=42,
        )
        clf.fit(x_train, y_train)
        accuracy = float(accuracy_score(y_test, clf.predict(x_test)))
        importances = {
            name: round(float(score), 5)
            for name, score in sorted(
                zip(FEATURE_NAMES, clf.feature_importances_, strict=True),
                key=lambda pair: pair[1],
                reverse=True,
            )
        }
        return ModelBundle(
            clf,
            {
                "algorithm": "RandomForestClassifier",
                "accuracy": round(accuracy, 4),
                "training_samples": int(len(y_train)),
                "test_samples": int(len(y_test)),
                "feature_names": list(FEATURE_NAMES),
                "feature_importances": importances,
            },
        )

    @staticmethod
    def _train_url_model() -> ModelBundle:
        urls, labels = build_url_dataset()
        return ModelRegistry._train_url_model_from_samples(urls, labels)

    @staticmethod
    def _train_message_model_from_samples(texts: list[str], labels: list[int]) -> ModelBundle:
        if not texts:
            raise ValueError("No message training data available.")

        target = np.array(labels, dtype=int)

        pipeline = Pipeline(
            [
                (
                    "tfidf",
                    TfidfVectorizer(
                        lowercase=True,
                        sublinear_tf=True,
                        ngram_range=(1, 2),
                        min_df=1,
                        max_features=20000,
                        strip_accents="unicode",
                    ),
                ),
                (
                    "clf",
                    LogisticRegression(
                        C=6.0, max_iter=2000, class_weight="balanced", random_state=42
                    ),
                ),
            ]
        )
        x_train, x_test, y_train, y_test = train_test_split(
            texts, target, test_size=0.2, random_state=42, stratify=target
        )
        pipeline.fit(x_train, y_train)
        accuracy = float(accuracy_score(y_test, pipeline.predict(x_test)))

        pipeline.fit(texts, target)
        return ModelBundle(
            pipeline,
            {
                "algorithm": "TfidfVectorizer + LogisticRegression",
                "accuracy": round(accuracy, 4),
                "training_samples": int(len(texts)),
                "test_samples": int(len(y_test)),
                "vocabulary_size": int(len(pipeline.named_steps["tfidf"].vocabulary_)),
            },
        )

    @staticmethod
    def _train_message_model() -> ModelBundle:
        texts, labels = build_message_dataset()
        return ModelRegistry._train_message_model_from_samples(texts, labels)

    # ---- Inference ------------------------------------------------------
    def predict_url(self, features) -> tuple[float, dict[str, Any]] | None:
        bundle = self.url_model()
        if bundle is None:
            return None
        try:
            vector = np.array([features.to_vector()], dtype=float)
            probability = float(bundle.estimator.predict_proba(vector)[0][1])
            return probability, bundle.metadata
        except Exception as exc:  # pragma: no cover
            logger.warning("URL model inference failed: %s", exc)
            return None

    def predict_message(self, text: str) -> tuple[float, dict[str, Any]] | None:
        bundle = self.message_model()
        if bundle is None:
            return None
        try:
            probability = float(bundle.estimator.predict_proba([text])[0][1])
            return probability, bundle.metadata
        except Exception as exc:  # pragma: no cover
            logger.warning("Message model inference failed: %s", exc)
            return None

    def top_message_terms(self, text: str, limit: int = 6) -> list[str]:
        """Terms in ``text`` with the highest learned scam weight."""
        bundle = self.message_model()
        if bundle is None:
            return []
        try:
            vectoriser = bundle.estimator.named_steps["tfidf"]
            classifier = bundle.estimator.named_steps["clf"]
            row = vectoriser.transform([text])
            names = vectoriser.get_feature_names_out()
            coefficients = classifier.coef_[0]
            scored = [
                (names[idx], float(row[0, idx]) * float(coefficients[idx]))
                for idx in row.nonzero()[1]
            ]
            scored.sort(key=lambda pair: pair[1], reverse=True)
            return [term for term, weight in scored[:limit] if weight > 0]
        except Exception:  # pragma: no cover
            return []

    def status(self) -> dict[str, Any]:
        url_bundle = self.url_model()
        message_bundle = self.message_model()
        return {
            "sklearn_available": SKLEARN_AVAILABLE,
            "url_model": url_bundle.metadata if url_bundle else None,
            "message_model": message_bundle.metadata if message_bundle else None,
            "mode": "hybrid_ml_heuristic" if url_bundle or message_bundle else "heuristic_only",
        }

    def feedback_examples(self, db: Session, *, user: User | None = None) -> tuple[list[str], list[int], list[str]]:
        urls: list[str] = []
        labels: list[int] = []
        kinds: list[str] = []

        statement = select(Scan).where(Scan.feedback.isnot(None))
        if user is not None:
            statement = statement.where(Scan.user_id == user.id)

        for scan in db.execute(statement).scalars().all():
            payload = scan.feedback or {}
            target = self._label_to_target(str(payload.get("label", "")))
            if target is None:
                continue

            if scan.url_scan is not None:
                urls.append(scan.url_scan.url)
                labels.append(target)
                kinds.append("URL")
            elif scan.message_scan is not None:
                urls.append(scan.message_scan.message_text)
                labels.append(target)
                kinds.append("MESSAGE")

        return urls, labels, kinds

    def retrain_from_feedback(self, db: Session, *, user: User | None = None, min_examples: int = 5) -> dict[str, Any]:
        if not SKLEARN_AVAILABLE:
            return {"retrained": False, "reason": "scikit-learn unavailable", "feedback_examples": 0}

        url_samples, url_labels, url_kinds = self.feedback_examples(db, user=user)
        message_samples, message_labels, message_kinds = self.feedback_examples(db, user=user)

        url_result: dict[str, Any] = {"retrained": False, "samples": 0, "kind": "URL"}
        message_result: dict[str, Any] = {"retrained": False, "samples": 0, "kind": "MESSAGE"}

        if len(url_samples) >= min_examples:
            base_urls, base_url_labels = build_url_dataset()
            combined_urls = base_urls + url_samples
            combined_labels = base_url_labels + url_labels
            bundle = self._train_url_model_from_samples(combined_urls, combined_labels)
            self._url = bundle
            self._url_failed = False
            self._persist_model(URL_MODEL_FILE, bundle)
            url_result = {
                "retrained": True,
                "samples": len(url_samples),
                "kind": "URL",
                "accuracy": bundle.metadata.get("accuracy"),
            }

        if len(message_samples) >= min_examples:
            base_texts, base_labels = build_message_dataset()
            combined_texts = base_texts + message_samples
            combined_labels = base_labels + message_labels
            bundle = self._train_message_model_from_samples(combined_texts, combined_labels)
            self._message = bundle
            self._message_failed = False
            self._persist_model(MESSAGE_MODEL_FILE, bundle)
            message_result = {
                "retrained": True,
                "samples": len(message_samples),
                "kind": "MESSAGE",
                "accuracy": bundle.metadata.get("accuracy"),
            }

        return {
            "retrained": url_result["retrained"] or message_result["retrained"],
            "feedback_examples": len(url_samples) + len(message_samples),
            "url": url_result,
            "message": message_result,
            "source_types": {"url": url_kinds, "message": message_kinds},
        }

    def _persist_model(self, filename: str, bundle: ModelBundle) -> None:
        path = self.model_dir / filename
        try:
            self.model_dir.mkdir(parents=True, exist_ok=True)
            joblib.dump(
                {"version": MODEL_FORMAT_VERSION, "estimator": bundle.estimator, "metadata": bundle.metadata},
                path,
            )
        except Exception as exc:  # pragma: no cover
            logger.warning("Could not persist model %s: %s", filename, exc)


registry = ModelRegistry()


def warm_up() -> dict[str, Any]:
    """Eagerly train/load both models. Safe to call on application startup."""
    if not settings.TRAIN_MODELS_ON_STARTUP:
        return {"warmed": False, "reason": "TRAIN_MODELS_ON_STARTUP disabled"}
    status = registry.status()
    return {"warmed": True, **status}
