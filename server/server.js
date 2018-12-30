import path from 'path';
import express from 'express';
import bodyParser from 'body-parser';
import webpack from 'webpack';
import invariant from 'invariant';
import {
  logAudioSession,
  logInteractiveSession,
  logSearchText,
} from './logger';
const { Pool } = require('pg');
const { postgraphile } = require('postgraphile');
import {
  GenerateAudiocardMutationPlugin,
} from './plugins';
const config = require('../config');
const PORT = config.get('PORT');
const useGraphiql = process.env.NODE_ENV === 'production' ? true : true;

const options = {
  user: config.get('POSTGRES_USER'),
  password: config.get('POSTGRES_PASSWORD'),
  host: config.get('POSTGRES_HOST'),
  database: 'postgres',
  port: 5432,
};

if (
  config.get('INSTANCE_CONNECTION_NAME') &&
  config.get('NODE_ENV') === 'production'
) {
  options.host = `/cloudsql/${config.get('INSTANCE_CONNECTION_NAME')}`;
}

const pool = new Pool(options);

const app = express();

app.use(bodyParser.json());

app.use('/graphql', (req, res, next) => {
  if (req.body) {
    const { operationName, variables } = req.body;
    if (operationName === 'searchDecks') {
      logSearchText({ pool, text: variables.search });
    }
  }
  next();
});

app.post('/interactive-sessions',(req, res) => {
  const { interactiveSession } = req.body || {};
  const { uid, userId = null, audiocardId, deckId, response, isCorrect } = interactiveSession;
  logInteractiveSession({ pool, uid, userId, audiocardId, deckId, response, isCorrect });
  res.json({status: 'ok'})
});

app.post('/audio-sessions',(req, res) => {
  const { audioSession } = req.body;
  const { uid, userId = null, audiocardId, deckId } = audioSession;
  logAudioSession({ pool, uid, userId, audiocardId, deckId });
  res.json({status: 'ok'})
});

//GraphQL Api
app.use(postgraphile(pool, 'doable', {
    graphiql: useGraphiql,
    appendPlugins: [
      GenerateAudiocardMutationPlugin,
    ],
  }));

const server = app.listen(PORT, (error) => {
  invariant(!error, 'Something failed: ', error);
  console.info('Express is listening on PORT %s.', PORT);
});

server.setTimeout(10 * 60 * 1000);
