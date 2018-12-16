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

#### Create Auidocard
```
mutation($generateAudiocardInput:GenerateAudiocardInput!) {
  generateAudiocard(input:$generateAudiocardInput) {
    audiocard {
      questionText
      questionAudioUri
      answerText
      answerAudioUri
    }
  }
}
{
  "generateAudiocardInput": {
    "questionText": "What is the capital of France",
    "answerText": "Paris"
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
      "title": "World Capitals"
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
      "title": "World Capitals"
    }
  }
}
```

#### Create DeckAudiocard
```
mutation($createDeckAudiocardInput:CreateDeckAudiocardInput!) {
  createDeckAudiocard(input:$createDeckAudiocardInput) {
    deckAudiocard {
      deckId
      audiocardByAudiocardId {
        answerAudioUri
        questionAudioUri
      }
    }
  }
}
{
  "createDeckAudiocardInput": {
    "deckAudiocard": {
      "deckId": 1,
      "audiocardId": 3
    }
  }
}
```


### Query

#### All Audiocards
```
query {
  allAudiocards {
    nodes {
      nodeId
      id
      questionText
      questionAudioUri
      answerText
      answerAudioUri
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
