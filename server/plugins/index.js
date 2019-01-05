const {
  makeExtendSchemaPlugin,
  gql,
} = require('graphile-utils');
import fs from 'fs';
import uuidv1 from 'uuid/v1';
import path from 'path';
import del from 'del';
import textToSpeech from '@google-cloud/text-to-speech';
import { Translate } from '@google-cloud/translate';
import googleStorage, { Storage } from '@google-cloud/storage';
const CLOUD_BUCKET = 'doable-audio';
const SECRETS_DIR = path.join(__dirname, '../../', 'secrets');
const client = new textToSpeech.TextToSpeechClient();

const storage = new Storage();
const bucket = storage.bucket(CLOUD_BUCKET);
const translate = new Translate();

function getPublicUrl (filename) {
  return `https://storage.googleapis.com/${CLOUD_BUCKET}/${filename}`;
}

export const GenerateAudiocardMutationPlugin =
makeExtendSchemaPlugin(build => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      input GenerateAudiocardInput {
        questionText: String!
        answerText: String!
      }

      type GenerateAudiocardPayload {
        audiocard: Audiocard @recurseDataGenerators
      }

      extend type Mutation {
        generateAudiocard(input: GenerateAudiocardInput!):
          GenerateAudiocardPayload
      }
    `,
    resolvers: {
      Mutation: {
        generateAudiocard: async (
          _query,
          args,
          context,
          resolveInfo,
          { selectGraphQLResultFromTable }
        ) => {
          const { pgClient } = context;
          let question_text = args.input.questionText;
          let answer_text = args.input.answerText;
          // Start a sub-transaction
          await pgClient.query('SAVEPOINT graphql_mutation');
          try {
            // Get the product values
            console.log('begin_translate_detect');
            const languageCodes = await Promise.all([getLanguageCode(question_text), getLanguageCode(answer_text)]);
            console.log('end_translate_detect');

            console.log('begin_text_to_speech');
            const results = await Promise.all([saveTextToSpeech({ text: question_text, languageCode: languageCodes[0] }), saveTextToSpeech({ text: answer_text, languageCode: languageCodes[1] })]);
            const question_audio_uri = results[0].uri;
            const answer_audio_uri = results[1].uri;

            console.log('end_text_to_speech');
            // Our custom logic to register the product:
            const { rows: [audiocard] } = await pgClient.query(
              `INSERT INTO doable.audiocard(
                question_text, question_audio_uri, answer_text, answer_audio_uri
              ) VALUES ($1, $2, $3, $4)
              RETURNING *`,
              [
                question_text,
                question_audio_uri,
                answer_text,
                answer_audio_uri
              ]
            );

            // Now we fetch the result that the GraphQL
            // client requested, using the new product
            // account as the source of the data.
            const [row] =
              await selectGraphQLResultFromTable(
                sql.fragment`doable.audiocard`,
                (tableAlias, sqlBuilder) => {
                  sqlBuilder.where(
                    sql.fragment`${tableAlias}.id = ${
                      sql.value(audiocard.id)
                    }`
                  );
                }
              );

            // Success! Write the product to the database.
            await pgClient.query('RELEASE SAVEPOINT graphql_mutation');

            // We pass the fetched result via the
            // `product` field to match the
            // @recurseDataGenerators directive
            // used above. GraphQL mutation
            // payloads typically have additional
            // fields.
            return {
              audiocard: row,
            };
          } catch (e) {
            // Oh noes! If at first you don't succeed,
            // destroy all evidence you ever tried.
            await pgClient.query('ROLLBACK TO SAVEPOINT graphql_mutation');
            throw e;
          }
        },
      },
    },
  };
});

const getLanguageCode = (text) => {
  return new Promise((resolve, reject) => {
    translate.detect(text)
      .then((data) => {
        const result = data[0] || {};
        const { language } = result;
        if (language.substring(0, 2) === 'en') {
          resolve('en-US');
        } else {
          resolve(language);
        }
      })
      .catch((err) => {
        console.log(err);
        reject(err);
      })
  });
}

const saveTextToSpeech = ({ text, languageCode }) => {
  return new Promise((resolve, reject) => {

    // Construct the request
    const request = {
      input: { text },
      voice: { languageCode, ssmlGender: 'NEUTRAL' },
      audioConfig: { audioEncoding: 'MP3' },
    };

    // Performs the Text-to-Speech request
    client.synthesizeSpeech(request, (err, response) => {
    if (err) {
      console.error('ERROR:', err);
      reject();
      return;
    }
      const uuid = uuidv1();
      const uri = `${uuid}.mp3`;
      const blob = bucket.file(uri);
      const blobStream = blob.createWriteStream({
        resumable: false,
        metadata: {
          cacheControl: 'public, max-age=31536000',
          contentType: 'audio/mpeg',
        },
        predefinedAcl: 'publicRead',
      });

      blobStream.on('error', err => {
        console.log(err);
        reject();
      });

      blobStream.on('finish', () => {
        resolve({ uri: getPublicUrl(uri) });
      });

      blobStream.end(response.audioContent);
    });
  });
}
