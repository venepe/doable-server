import path from 'path';
import fs from 'fs';
import express from 'express';
import bodyParser from 'body-parser';
import webpack from 'webpack';
import invariant from 'invariant';
import jwt from 'express-jwt';
import { resolveUpload } from './lib';
import Document from './lib/document';
import {
  logSearchText,
} from './logger';
const { Pool } = require('pg');
const { postgraphile } = require('postgraphile');
const config = require('../config');
const PORT = config.get('PORT');
const SECRETS_DIR = path.join(__dirname, '../', 'secrets');
var publicKey = fs.readFileSync(`${SECRETS_DIR}/d0able.pem`);
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

app.use('/graphql',
 // jwt({secret: publicKey}),
 (req, res, next) => {
  console.log(req.user);
  if (req.body) {
    const { operationName, variables } = req.body;
    if (operationName === 'searchDecks') {
      logSearchText({ pool, text: variables.search });
    }
  }
  next();
});

//GraphQL Api
app.use(postgraphile(pool, 'doable', {
    graphiql: useGraphiql,
    appendPlugins: [
    ],
  }));

app.post('/document',
Document.multer.single('document'),
Document.sendUploadToGCS,
(req, res) => {
  let { deckId, userUid } = req.body;

  // Was an image uploaded? If so, we'll use its public URL
  // in cloud storage.
  if (req.file && req.file.cloudStoragePublicUrl) {
    const imageUri = req.file.cloudStoragePublicUrl;
    const text = req.textDetection;
    const insert = 'INSERT INTO doable.document(user_uid, deck_id, image_uri, text) VALUES($1, $2, $3, $4) RETURNING *';

    pool.query({ text: insert, values: [ userUid, deckId, imageUri, text ] })
      .then((result) => {
        res.json({ document: result.rows[0]});
      })
      .catch(e => console.error(e.stack))
  }
});

const server = app.listen(PORT, (error) => {
  invariant(!error, 'Something failed: ', error);
  console.info('Express is listening on PORT %s.', PORT);
});

server.setTimeout(10 * 60 * 1000);
