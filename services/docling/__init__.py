from .docling_service import DoclingClient, client
from basemodel.services_docling.docling_model import DoclingResult, ParsedChunk, ParsedTable, SupportedExtension

__all__ = ["DoclingClient", "DoclingResult", "ParsedChunk", "ParsedTable", "SupportedExtension", "client"]
