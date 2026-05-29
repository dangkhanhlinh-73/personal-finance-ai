"""Public extractor entry point — delegates to format-specific submodules."""

from .extractors import Transaction, detect_format, extract_transactions

__all__ = ["Transaction", "detect_format", "extract_transactions"]
