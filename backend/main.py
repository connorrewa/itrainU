from fastapi import FastAPI, Request, APIRouter, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pymongo import MongoClient
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
from openai import OpenAI
from typing import List, Dict
from pydantic import BaseModel
import json
import io
import base64
from PIL import Image
import fitz  # PyMuPDF
import requests
import slideshow_generator
from pydantic import BaseModel


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class PresentationRequest(BaseModel):
    title: str
    keyGoals: str = ''
    fileContent: str

class ChatRequest(BaseModel):
    message: str

class MessageRequest(BaseModel):
    message: str

router = APIRouter()
load_dotenv()

# MongoDB setup - updated to match your script
MONGODB_URI = os.getenv("MONGODB_URI")
client = MongoClient(MONGODB_URI)
db = client["Team4"]
collection = db["embeddings"]  # Changed to match your script's collection name

# OpenAI setup
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.api_route("/api", methods=["GET", "POST", "PUT", "DELETE"])
async def handle_crud():
    return {"message": "Handling CRUD operations"}

@app.post("/api/rag_chat")
async def rag_chat(request: ChatRequest):
    try:
        print(f"Processing RAG chat request with message: {request.message}")
        
        # Debug: Check if collection exists and has documents
        doc_count = collection.count_documents({})
        print(f"Number of documents in collection: {doc_count}")
        
        # Debug: Print a sample document to check structure
        sample_doc = collection.find_one({})
        print(f"Sample document structure: {sample_doc}")
        
        # 1. Get embedding for the user's message
        query_embedding_response = openai_client.embeddings.create(
            model="text-embedding-ada-002",
            input=request.message
        )
        query_embedding = query_embedding_response.data[0].embedding
        print(f"Generated query embedding of length: {len(query_embedding)}")

        # 2. Search for relevant context using vector similarity
        try:
            # First, check available indexes
            indexes = collection.list_indexes()
            print("Available indexes:")
            for index in indexes:
                print(f"Index: {index}")

            pipeline = [
                {
                    "$vectorSearch": {   
                        "index": "vector_index",  # Make sure this matches your Atlas index name
                        "path": "embedding",
                        "queryVector": query_embedding,
                        "numCandidates": 100,
                        "limit": 5
                    }
                },
                {
                    "$project": {
                        "text": 1,
                        "metadata": 1,
                        "score": {"$meta": "vectorSearchScore"},
                        "_id": 0
                    }
                }
            ]

            print("Executing vector search pipeline...")
            results = list(collection.aggregate(pipeline))
            print(f"Vector search returned {len(results)} results")
            
            if not results:
                # If no vector search results, try basic text search
                print("No vector search results, attempting basic text search")
                results = list(collection.find(
                    {},  # Get all documents since we don't have text index
                    {"text": 1, "metadata": 1, "_id": 0}
                ).limit(5))
                print(f"Basic search returned {len(results)} results")

        except Exception as search_error:
            print(f"Search error: {str(search_error)}")
            # Log the full error details
            import traceback
            print(f"Full error traceback: {traceback.format_exc()}")
            
            # Try a simple find operation as fallback
            results = list(collection.find(
                {},
                {"text": 1, "metadata": 1, "_id": 0}
            ).limit(5))
            print(f"Fallback search returned {len(results)} results")

        # 3. Extract and combine relevant context
        contexts = [doc.get("text", "") for doc in results]
        concatenated_context = " ".join(contexts)
        print(f"Found {len(contexts)} context segments")

        if not contexts:
            return {
                "answer": "I don't have enough context to answer your question accurately. Could you please provide more details or rephrase your question?",
                "context_used": []
            }

        # 4. Create prompt with context and user's question
        prompt = f"""Use your knowledge to answer the question in a conversational manner. Please give a short and brief answer no longer than 3 scentences. If your knowledge doesn't contain relevant information, let them know you dont know the answer, or if its out of your scope.
        
Your Knowledge: {concatenated_context}

Question: {request.message}

Answer: """

        # 5. Generate response using OpenAI
        chat_response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that answers questions based on the provided context."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=500
        )

        # 6. Extract and return the response
        answer = chat_response.choices[0].message.content
        print(f"Generated answer: {answer}")

        return {
            "answer": answer,
            "context_used": contexts
        }
    except Exception as e:
        print(f"RAG chat error: {str(e)}")
        import traceback
        print(f"Full error traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create_new_presentation")
async def create_new_presentation(presentation: PresentationRequest):
    print(presentation)

    try:
        print('Received request to create new presentation')
        [presentation_id, scripts] = slideshow_generator.main(presentation.title, presentation.keyGoals, presentation.fileContent)
        
        return {"message": "Presentation created successfully",
                "status": "success",
                "presentation_id": presentation_id,
                "scripts": scripts,
                }
    except Exception as e:
        print(f"Error creating presentation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

app.include_router(router, prefix="/api")