## Readme

### Getting Started

```
export DATABASE_URL=postgresql://postgres:supersecretpswd@localhost:5432/postgres
docker-compose up
yarn
yarn migrate up
yarn dev
```

### Mutations


#### Create User
```
mutation($createUserInput:CreateUserInput!) {
  createUser(input:$createUserInput) {
    user {
      id
    }
  }
}
{
  "createUserInput": {
    "user": {
      "email": "vernon@doable.com"
    }
  }
}
```

#### Create Deck
```
mutation($createDeckInput:CreateDeckInput!) {
  createDeck(input:$createDeckInput) {
    deck {
      title
      description
    }
  }
}
{
  "createDeckInput": {
    "deck": {
      "title": "World Capitals",
      "userId": 1
    }
  }
}
```

#### Create Document
```
mutation($createDocumentInput:CreateDocumentInput!) {
  createDocument(input:$createDocumentInput) {
    document {
      id
    }
  }
}
{
  "createDocumentInput": {
    "document": {
      "userId": 1,
      "imageUri": "http://test.com",
      "deckId": 1
    }
  }
}
```

#### Create DeckCard
```
mutation($createCardInput:CreateCardInput!) {
  createCard(input:$createCardInput) {
    card {
      deckId
      frontText
      backText
    }
  }
}
{
  "createCardInput": {
    "card": {
      "deckId": 1,
      "frontText": "What is the capital of the US",
      "backText": "Washington, D.C.",
      "documentId": 1
    }
  }
}
```


### Query

#### All Cards
```
query {
  allCards {
    nodes {
      nodeId
      id
      frontText
      backText
      createdAt
    }
  }
}
```

#### All Decks
```
query {
  allDecks {
    nodes {
      nodeId
      id
      title
      description
      createdAt
    }
  }
}
```
