## Readme

### Getting Started

```
export DATABASE_URL=postgresql://postgres:f4IPIg*3GIMz@35.224.70.228:5432/postgres
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

#### Create Card
```
mutation($createCardInput:CreateCardInput!) {
  createCard(input:$createCardInput) {
    card {
      id
      frontText
      backText
    }
  }
}
{
  "createCardInput": {
    "card": {
      "frontText": "Jackalope",
      "backText": "A hopeful animal",
      "deckId": 1
      "frontTextIndexes": "[{\"documentId\":12,\"wordIndexes\":[0]}]",
      "backTextIndexes": "[{\"documentId\":12,\"wordIndexes\":[3,4,5]}]",
    }
  }
}
```



#### Front And Back Text Indexes
```
[
  {
    documentId,
    wordIndexes
  }
]
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

### Deploying to Google Cloud
```
source ~/.bashrc
```

```
gcloud app deploy app.yaml
```
