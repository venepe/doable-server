import path from 'path';
import express from 'express';
import bodyParser from 'body-parser';
import webpack from 'webpack';
import invariant from 'invariant';
import {
  logSearchText,
} from './logger';
const { Pool } = require('pg');
const { postgraphile } = require('postgraphile');
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

//GraphQL Api
app.use(postgraphile(pool, 'doable', {
    graphiql: useGraphiql,
    appendPlugins: [
    ],
  }));

const server = app.listen(PORT, (error) => {
  invariant(!error, 'Something failed: ', error);
  console.info('Express is listening on PORT %s.', PORT);
});

server.setTimeout(10 * 60 * 1000);
