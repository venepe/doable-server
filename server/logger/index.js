const statements = {
  INSERT_SEARCH_TEXT: 'INSERT INTO logger.search(text) VALUES($1)',
  INSERT_INTERATIVE_SESSION: 'INSERT INTO logger.interactive_session(uid, user_id, audiocard_id, deck_id, response, is_correct) VALUES($1, $2, $3, $4, $5, $6)',
  INSERT_AUDIO_SESSION: 'INSERT INTO logger.audio_session(uid, user_id, audiocard_id, deck_id) VALUES($1, $2, $3, $4)',
};

export const logSearchText = ({pool, text}) => {
  pool.query(statements.INSERT_SEARCH_TEXT, [text]);
}

export const logInteractiveSession = ({pool, uid, userId = null, audiocardId, deckId, response, isCorrect}) => {
  console.log(uid, audiocardId, deckId, response, isCorrect);
  pool.query(statements.INSERT_INTERATIVE_SESSION, [uid, userId, audiocardId, deckId, response, isCorrect]);
}

export const logAudioSession = ({pool, uid, userId = null, audiocardId, deckId}) => {
  pool.query(statements.INSERT_AUDIO_SESSION, [uid, userId, audiocardId, deckId]);
}
