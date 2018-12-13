import path from 'path';
import express from 'express';
import bodyParser from 'body-parser';
import webpack from 'webpack';
import invariant from 'invariant';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';
import webpackDevConfig from '../webpack/webpack.dev.babel';
const { Pool } = require('pg');
const { postgraphile } = require('postgraphile');
import {
  GenerateAudiocardMutationPlugin,
} from './plugins';
const PORT = 3000;
const DIST_DIR = path.resolve(__dirname, '..', 'public');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'supersecretpswd',
  port: 5432,
});

const app = express();

app.use(bodyParser.json());

app.use('/graphql', (req, res, next) => {
  if (req.body) {
  }
  next();
});

//GraphQL Api
app.use(postgraphile(pool, 'doable', {
    graphiql: true,
    appendPlugins: [
      GenerateAudiocardMutationPlugin,
    ],
  }));

const server = app.listen(PORT, (error) => {
  invariant(!error, 'Something failed: ', error);
  console.info('Express is listening on PORT %s.', PORT);
});

server.setTimeout(10 * 60 * 1000);
