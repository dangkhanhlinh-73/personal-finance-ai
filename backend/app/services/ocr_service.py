import os
import re
import cv2
import pytesseract

from PIL import Image
from fastapi import UploadFile

from app.config import settings

pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD


def extract_text_from_image(image_path: str):
    image = cv2.imread(image_path)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    gray = cv2.GaussianBlur(gray, (3, 3), 0)

    text = pytesseract.image_to_string(
        gray,
        lang=settings.OCR_LANG,
    )

    return text


def extract_amount(text: str):
    patterns = [
        r"(\d{1,3}(?:[\.,]\d{3})+)",
        r"(\d+[\.,]\d+)",
    ]

    for pattern in patterns:
        matches = re.findall(pattern, text)

        if matches:
            amount = matches[0]

            amount = (
                amount.replace(".", "")
                .replace(",", "")
            )

            try:
                return int(amount)
            except:
                pass

    return 0


def detect_transaction_type(text: str):
    text = text.lower()

    income_keywords = [
        "nhận tiền",
        "chuyển đến",
        "thu nhập",
        "salary",
        "income",
    ]

    for keyword in income_keywords:
        if keyword in text:
            return "income"

    return "expense"


async def process_receipt(file: UploadFile):
    upload_dir = "uploads"

    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, file.filename)

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    text = extract_text_from_image(file_path)

    amount = extract_amount(text)

    transaction_type = detect_transaction_type(text)

    return {
        "raw_text": text,
        "amount": amount,
        "transaction_type": transaction_type,
    }