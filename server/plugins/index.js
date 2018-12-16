const {
  makeExtendSchemaPlugin,
  gql,
} = require('graphile-utils');
import fs from 'fs';
import uuidv1 from 'uuid/v1';
import path from 'path';
import del from 'del';
import textToSpeech from '@google-cloud/text-to-speech';
import googleStorage, { Storage } from '@google-cloud/storage';
const CLOUD_BUCKET = 'doable-audio';
const AUDIO_DIR = path.join(__dirname, '../../', 'audio');
const SECRETS_DIR = path.join(__dirname, '../../', 'secrets');
console.log(AUDIO_DIR);
const client = new textToSpeech.TextToSpeechClient({
  projectId: 'doable',
  keyFilename: `${SECRETS_DIR}/doable-text-to-speech-sa.json`,
});

const storage = new Storage({
  projectId: 'doable',
  keyFilename: `${SECRETS_DIR}/doable-storage-sa.json`,
});
const bucket = storage.bucket(CLOUD_BUCKET);

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
            console.log('begin_text_to_speech');
            const results = await Promise.all([saveTextToSpeech(question_text), saveTextToSpeech(answer_text)]);
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

const saveTextToSpeech = (text) => {
  return new Promise((resolve, reject) => {

    // Construct the request
    const request = {
      input: { text },
      voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
      audioConfig: { audioEncoding: 'MP3' },
    };

    // Performs the Text-to-Speech request
    client.synthesizeSpeech(request, (err, response) => {
    if (err) {
      console.error('ERROR:', err);
      reject();
      return;
    }

    // Write the binary audio content to a local file
    const uuid = uuidv1();
    const uri = `${AUDIO_DIR}/${uuid}.mp3`;
    fs.writeFile(uri, response.audioContent, 'binary', err => {
      if (err) {
        console.error('ERROR:', err);
        reject();
        return;
      }
      console.log('Audio content written to file: output.mp3');
      storage.bucket(CLOUD_BUCKET).upload(uri, {
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
        predefinedAcl: 'publicRead',
      })
      .then(() => {
        del(uri);
        resolve({ uri: getPublicUrl(`${uuid}.mp3`) });
      })
      .catch((err) => {
        console.log(err);
        reject();
      });
    });
  });
  });
}
