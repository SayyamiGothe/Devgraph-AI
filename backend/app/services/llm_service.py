from groq import Groq
from app.core.config import settings


class LLMService:

    def __init__(self):
        self.client=Groq(api_key=settings.GROQ_API_KEY)

    def generate_answer(self,question:str,context:str):

     prompt = f"""
You are a helpful RAG assistant.

Answer the question using only the provided context.

If the answer is not present in the context,
say that you don't have enough information.

Context:
{context}

Question:
{question}

Answer:
""" 

     response=self.client.chat.completions.create(
          model=settings.MODEL_NAME,
          messages=[
             {
                "role":"system",
                "content":"You are a helpful RAG assistent"
             },
             {
                "role":"user",
                "content":prompt
             },
           
          ], temperature=0
       )

     return response.choices[0].message.content

    