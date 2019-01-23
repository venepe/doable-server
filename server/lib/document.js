import Multer from 'multer';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import Vision from '@google-cloud/vision';
const config = require('../../config');
const CLOUD_BUCKET = config.get('CLOUD_BUCKET');
const SECRETS_DIR = path.join(__dirname, '../../', 'secrets');

const storage = new Storage({
  projectId: 'doable',
  keyFilename: `${SECRETS_DIR}/doable-storage-sa.json`,
});

const vision = new Vision.ImageAnnotatorClient({
  projectId: 'doable',
  keyFilename: `${SECRETS_DIR}/doable-storage-sa.json`,
});

const bucket = storage.bucket(CLOUD_BUCKET);

const multer = Multer({
  storage: Multer.MemoryStorage,
  limits: {
    fileSize: 12 * 1024 * 1024,
  },
});

function getPublicUrl (filename) {
  return `https://storage.googleapis.com/${CLOUD_BUCKET}/${filename}`;
}

function sendUploadToGCS (req, res, next) {
  if (!req.file) {
    return next();
  }
  console.log('file');
  const { buffer, originalname, mimetype } = req.file;
  const gcsname = Date.now() + originalname;
  const file = bucket.file(gcsname);

  const stream = file.createWriteStream({
    resumable: false,
    metadata: {
      cacheControl: 'public, max-age=31536000',
      contentType: mimetype,
    },
    predefinedAcl: 'publicRead',
  });

  stream.on('error', (err) => {
    req.file.cloudStorageError = err;
    next(err);
  });

  stream.on('finish', () => {
    console.log('start');
    textDetection(gcsname).then((textDetection) => {
      req.file.cloudStorageObject = gcsname;
      req.file.cloudStoragePublicUrl = getPublicUrl(gcsname);
      req.textDetection = textDetection;
      next();
    });
  });

  stream.end(buffer);
}

function textDetection(filename) {
  console.log('textDetection');
  const gsUri = `gs://${CLOUD_BUCKET}/${filename}`;
  return vision.documentTextDetection(gsUri)
    .then(([result]) => {
      const fullTextAnnotation = result.fullTextAnnotation;
      console.log(`Full text: ${fullTextAnnotation.text}`);
      let text = fullTextAnnotation.text.replace(/\s/g, ' ');

      console.log(text);
      return text;
    });
}

module.exports = {
  getPublicUrl,
  sendUploadToGCS,
  multer
};
