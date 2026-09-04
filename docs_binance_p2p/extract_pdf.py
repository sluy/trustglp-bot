from PyPDF2 import PdfReader
import sys

def extract_text(pdf_path):
    try:
        reader = PdfReader(pdf_path)
        text = ""
        for i, page in enumerate(reader.pages):
            text += f"--- Page {i+1} ---\n"
            text += page.extract_text() + "\n"
        with open("doc_api_binance.txt", "w", encoding="utf-8") as f:
            f.write(text)
        print("Text extracted successfully to doc_api_binance.txt")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    extract_text("doc_api_binance.pdf")
