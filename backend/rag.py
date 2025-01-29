import asyncio
import base64
import io
from datetime import datetime, UTC
from PIL import Image
from fastapi import HTTPException
import fitz
from pymongo import MongoClient
from openai import OpenAI
import os

# MongoDB connection URI, database, and collection names
MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = "Team4"
COLLECTION_NAME = "embeddings"

# Initialize MongoDB client
mongodb_client = MongoClient(MONGODB_URI)

# Initialize OpenAI client (assuming you have set up your credentials)
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
# Function to create text chunks
def create_text_chunks(text, chunk_size=1000, overlap=200):
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start = end - overlap
    return chunks

async def process_file(filepath):
    try:
        collection = mongodb_client[DB_NAME][COLLECTION_NAME]
        
        # Clear existing documents in the collection
        collection.delete_many({})
        print("Cleared existing documents from the collection.")
        
        with open(filepath, 'rb') as file:
            content = file.read()
        
        file_extension = filepath.lower().split('.')[-1]
        preview_image = None
        
        # Process PDF file
        if file_extension == 'pdf':
            pdf_document = fitz.open(stream=content, filetype="pdf")
            text = ""
            for page in pdf_document:
                text += page.get_text()
            
            if len(pdf_document) > 0:
                first_page = pdf_document[0]
                pix = first_page.get_pixmap(matrix=fitz.Matrix(1, 1))
                img_data = pix.tobytes("png")
                preview_image = base64.b64encode(img_data).decode()
            pdf_document.close()
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_extension}")
        
        # Create and process chunks
        chunks = create_text_chunks(text)
        embedded_chunks = []
        
        # Batch embedding creation to handle multiple chunks
        for i in range(0, len(chunks), 10):  # Process in batches of 10
            batch_chunks = chunks[i:i+10]
            try:
                embedding_response = openai_client.embeddings.create(
                    model="text-embedding-ada-002",
                    input=batch_chunks
                )
                
                # Create embedded chunks with individual metadata
                for chunk, embedding in zip(batch_chunks, embedding_response.data):
                    embedded_chunks.append({
                        "text": chunk,
                        "embedding": embedding.embedding,
                        "metadata": {
                            "filename": filepath,
                            "preview_image": preview_image,
                            "file_type": file_extension,
                            "upload_timestamp": datetime.now(UTC).isoformat(),
                            "file_size": len(content),
                            "chunk_index": len(embedded_chunks)
                        }
                    })
            except Exception as e:
                print(f"Error creating embeddings: {str(e)}")
                continue
        
        if embedded_chunks:
            collection.insert_many(embedded_chunks)
            return {
                "message": f"Successfully processed {len(embedded_chunks)} chunks",
                "status": "success",
                "chunk_count": len(embedded_chunks)
            }
        else:
            return {
                "message": "No chunks were embedded.",
                "status": "failure"
            }
    except Exception as e:
        print(f"Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Main function to run the script
async def main():
    response = await process_file("input.pdf")
    print(response)

# Run the script
if __name__ == "__main__":
    asyncio.run(main())