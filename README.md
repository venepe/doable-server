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

#### Create DeckCard
```
mutation($createDeckCardInput:CreateDeckCardInput!) {
  createDeckCard(input:$createDeckCardInput) {
    deckCard {
      deckId
      cardByCardId {
        frontText
        backText
      }
    }
  }
}
{
  "createDeckCardInput": {
    "deckCard": {
      "deckId": 1,
      "cardId": 3
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
