import path from 'path';
import fs from 'fs';
import express from 'express';
import bodyParser from 'body-parser';
import webpack from 'webpack';
import invariant from 'invariant';
import jwt from 'express-jwt';
import Document from './lib/document';
import {
  logSearchText,
} from './logger';
const { Pool } = require('pg');
const format = require('pg-format');
const { postgraphile } = require('postgraphile');
const PgOmitArchived = require('@graphile-contrib/pg-omit-archived');
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
      PgOmitArchived
    ],
    graphileBuildOptions: {
      pgArchivedColumnName: 'is_archived',
    },
  }));

  app.post('/deck',
  Document.multer.single('document'),
  Document.sendUploadToGCS,
  (req, res) => {
    let { userUid } = req.body;

    // Was an image uploaded? If so, we'll use its public URL
    // in cloud storage.
    if (!req.objectDetection && req.file && req.file.cloudStoragePublicUrl) {
      const title = req.file.originalname;
      const imageUri = req.file.cloudStoragePublicUrl;
      if (req.textDetections) {
        const textDetections = req.textDetections;
        const insert = 'INSERT INTO doable.deck(user_uid, title) VALUES($1, $2) RETURNING *';
        let deck = {};
        pool.query({ text: insert, values: [ userUid, title ] })
          .then((result) => {
            const { id, user_uid, title, created_at } = result.rows[0];
            deck = {
              userUid: user_uid,
              createdAt: created_at,
              title,
              id,
            };
            let formattedDocuments = [];
            textDetections.forEach((text) => {
              formattedDocuments.push([ userUid, deck.id, imageUri, text ]);
            });
            let query = format('INSERT INTO doable.document(user_uid, deck_id, image_uri, text) VALUES %L RETURNING *', formattedDocuments);
            return pool.query(query)
          })
          .then((result) => {
            let documents = [];
            result.rows.forEach((row) => {
              const { id, user_uid, deck_id, image_uri, text, created_at } = row;
              const document = {
                userUid: user_uid,
                deckId: deck_id,
                imageUri: image_uri,
                createdAt: created_at,
                text,
                id,
              };
              documents.push(document);
            });
            // for now, just return deck
            res.json({ deck });
          })
          .catch(e => console.error(e.stack));
      }
    } else {
      let message = `No Text. Just a ${req.objectDetection}.`;
      res.status(400).json({
        message,
      });
    }
  });

app.post('/document',
Document.multer.single('document'),
Document.sendUploadToGCS,
(req, res) => {
  let { deckId, userUid } = req.body;

  // Was an image uploaded? If so, we'll use its public URL
  // in cloud storage.
  if (!req.objectDetection && req.file && req.file.cloudStoragePublicUrl) {
    const imageUri = req.file.cloudStoragePublicUrl;
    if (req.textDetection) {
      const text = req.textDetection;
      const insert = 'INSERT INTO doable.document(user_uid, deck_id, image_uri, text) VALUES($1, $2, $3, $4) RETURNING *';

      pool.query({ text: insert, values: [ userUid, deckId, imageUri, text ] })
        .then((result) => {
          const { id, user_uid, deck_id, image_uri, text, created_at } = result.rows[0];
          const document = {
            userUid: user_uid,
            deckId: deck_id,
            imageUri: image_uri,
            createdAt: created_at,
            text,
            id,
          };
          res.json({ document });
        })
        .catch(e => console.error(e.stack));
    } else if (req.textDetections) {
      const textDetections = req.textDetections;
      let formattedDocuments = [];
      textDetections.forEach((text) => {
        formattedDocuments.push([ userUid, deckId, imageUri, text ]);
      });
      let query = format('INSERT INTO doable.document(user_uid, deck_id, image_uri, text) VALUES %L RETURNING *', formattedDocuments);

      pool.query(query)
        .then((result) => {
          let documents = [];
          result.rows.forEach((row) => {
            const { id, user_uid, deck_id, image_uri, text, created_at } = row;
            const document = {
              userUid: user_uid,
              deckId: deck_id,
              imageUri: image_uri,
              createdAt: created_at,
              text,
              id,
            };
            documents.push(document);
          });
          res.json({ documents });
        })
        .catch(e => console.error(e.stack));
    }
  } else {
    let message = `No Text. Just a ${req.objectDetection}.`;
    res.status(400).json({
      message,
    });
  }
});

app.use( (err, req, res, next) => {
  console.log(err.stack);
  if (req.objectDetection) {
    let message = `No Text. Just a ${req.objectDetection}.`;
    res.status(400).json({
      message,
    });
  } else {
    res.status(500).send();
  }
});

const server = app.listen(PORT, (error) => {
  invariant(!error, 'Something failed: ', error);
  console.info('Express is listening on PORT %s.', PORT);
});

server.setTimeout(10 * 60 * 1000);
