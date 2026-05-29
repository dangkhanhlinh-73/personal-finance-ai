"""Draw OCR boxes and recognized text onto an image for debugging."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Union

import cv2
import numpy as np


def draw_boxes(
    image_rgb: np.ndarray,
    items: List[Dict],
    output_path: Union[str, Path],
    color=(0, 255, 0),
    thickness: int = 2,
) -> None:
    img = image_rgb.copy()
    for it in items:
        poly = np.asarray(it["box"], dtype=np.int32).reshape(-1, 1, 2)
        cv2.polylines(img, [poly], isClosed=True, color=color, thickness=thickness)
    cv2.imwrite(str(output_path), cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
