"""End-to-end OCR pipeline: detect with PaddleOCR, recognize with VietOCR."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Union

import cv2
import numpy as np
from PIL import Image


def _order_points(pts: np.ndarray) -> np.ndarray:
    """Return points ordered as top-left, top-right, bottom-right, bottom-left."""
    pts = np.asarray(pts, dtype=np.float32)
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1).reshape(-1)
    rect = np.zeros((4, 2), dtype=np.float32)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def crop_polygon(image: np.ndarray, poly: np.ndarray, pad: int = 2) -> np.ndarray:
    """Rectify a polygon region from `image` via perspective warp.

    Falls back to axis-aligned crop when polygon is not 4 points or too small.
    """
    poly = np.asarray(poly, dtype=np.float32)
    h_img, w_img = image.shape[:2]

    if poly.shape[0] != 4:
        x_min = max(0, int(poly[:, 0].min()) - pad)
        y_min = max(0, int(poly[:, 1].min()) - pad)
        x_max = min(w_img, int(poly[:, 0].max()) + pad)
        y_max = min(h_img, int(poly[:, 1].max()) + pad)
        return image[y_min:y_max, x_min:x_max]

    rect = _order_points(poly)
    (tl, tr, br, bl) = rect
    width = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
    height = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))
    if width < 4 or height < 4:
        x_min = max(0, int(poly[:, 0].min()) - pad)
        y_min = max(0, int(poly[:, 1].min()) - pad)
        x_max = min(w_img, int(poly[:, 0].max()) + pad)
        y_max = min(h_img, int(poly[:, 1].max()) + pad)
        return image[y_min:y_max, x_min:x_max]

    dst = np.array(
        [[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]],
        dtype=np.float32,
    )
    M = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, M, (width, height))


def load_image_rgb(image_path: Union[str, Path]) -> np.ndarray:
    img = cv2.imread(str(image_path))
    if img is None:
        raise FileNotFoundError(f"Cannot read image at {image_path}")
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def run(
    image_path: Union[str, Path],
    detector,
    recognizer,
) -> List[Dict]:
    """Run detect+recognize pipeline on one image. Returns list of {box, text}."""
    image_rgb = load_image_rgb(image_path)
    polys = detector.detect(image_path)

    items: List[Dict] = []
    for poly in polys:
        crop = crop_polygon(image_rgb, poly)
        if crop is None or crop.size == 0 or crop.shape[0] < 4 or crop.shape[1] < 4:
            continue
        pil = Image.fromarray(crop)
        try:
            text = recognizer.recognize(pil)
        except Exception as exc:  # pragma: no cover - log and skip on bad crops
            text = ""
        items.append({"box": poly.tolist(), "text": text or ""})
    return items
