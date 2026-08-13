import requests
import json


API_URL = "http://127.0.0.1:8000/rag/ask"

CONVERSATION_ID = 1


def load_questions():

    with open(
        "evaluation/questions.json",
        "r",
        encoding="utf-8",
    ) as file:

        return json.load(file)


def evaluate():

    questions = load_questions()

    results = []

    for item in questions:

        question = item["question"]
        project_id = item["project_id"]

        payload = {
            "question": question,
            "project_id": project_id,
            "conversation_id": CONVERSATION_ID,
            "top_k": 5,
        }

        response = requests.post(
            API_URL,
            json=payload,
        )

        if response.status_code != 200:

            print(
                f"ERROR: {question}"
            )

            print(response.text)

            continue

        result = response.json()

        results.append(
            {
                "question": question,
                "answer": result["answer"],
                "sources": result["sources"],
            }
        )

    return results


if __name__ == "__main__":

    results = evaluate()

    for result in results:

        print("\n" + "=" * 60)

        print(
            f"Question: {result['question']}"
        )

        print(
            f"Answer: {result['answer']}"
        )

        print(
            f"Sources: {result['sources']}"
        )