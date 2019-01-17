import path from 'path';
import uuidv1 from 'uuid/v1';
import { Storage } from '@google-cloud/storage';
const CLOUD_BUCKET = 'doable-audio';
const SECRETS_DIR = path.join(__dirname, '../../', 'secrets');

const storage = new Storage({
  projectId: 'doable',
  keyFilename: `${SECRETS_DIR}/doable-storage-sa.json`,
});
const bucket = storage.bucket(CLOUD_BUCKET);

function getPublicUrl (filename) {
  return `https://storage.googleapis.com/${CLOUD_BUCKET}/${filename}`;
}

export function resolveUpload(upload) {
  console.log('resolveUpload');
  return new Promise((resolve, reject) => {

    console.log('upload');

    const { filename, mimetype, encoding, createReadStream } = upload;
    const stream = createReadStream();

    const gcsName = Date.now() + filename;
    const gcsFile = bucket.file(gcsName);
    const gcsStream = gcsFile.createWriteStream({
      resumable: false,
      metadata: {
        cacheControl: 'public, max-age=31536000',
        contentType: mimetype,
      },
      predefinedAcl: 'publicRead',
    });

    stream.on('error', (err) => {
      reject(err);
    });

    stream.on('finish', () => {
      resolve(getPublicUrl(gcsName));
    });

    stream.pipe(gcsStream);
  });
}
