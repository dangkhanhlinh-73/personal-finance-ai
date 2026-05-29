"""Text recognition wrapper around VietOCR."""

from __future__ import annotations

from typing import List

from PIL import Image


class TextRecognizer:
    def __init__(self, model_name: str = "vgg_transformer", device: str = "cuda:0"):
        from vietocr.tool.config import Cfg
        from vietocr.tool.predictor import Predictor

        config = Cfg.load_config_from_name(model_name)
        config["device"] = device
        config["predictor"]["beamsearch"] = False
        self.predictor = Predictor(config)

    def recognize(self, pil_image: Image.Image) -> str:
        if pil_image.mode != "RGB":
            pil_image = pil_image.convert("RGB")
        return self.predictor.predict(pil_image)

    def recognize_batch(self, pil_images: List[Image.Image]) -> List[str]:
        return [self.recognize(im) for im in pil_images]
