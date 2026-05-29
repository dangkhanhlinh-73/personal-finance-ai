"""Text detection wrapper around PaddleOCR's TextDetection module."""

from __future__ import annotations

from pathlib import Path
from typing import List, Union

import numpy as np


class TextDetector:
    def __init__(self, lang: str = "vi", enable_mkldnn: bool = False, **kwargs):
        from paddleocr import TextDetection

        kwargs.setdefault("enable_mkldnn", enable_mkldnn)
        self.model = TextDetection(**kwargs)
        self.lang = lang

    def detect(self, image: Union[str, Path, np.ndarray]) -> List[np.ndarray]:
        if isinstance(image, Path):
            image = str(image)
        results = self.model.predict(image)
        polys: List[np.ndarray] = []
        for res in results:
            data = res if isinstance(res, dict) else dict(res)
            dt_polys = data.get("dt_polys", [])
            for poly in dt_polys:
                arr = np.asarray(poly, dtype=np.float32)
                if arr.ndim == 2 and arr.shape[0] >= 3:
                    polys.append(arr)
        return polys
