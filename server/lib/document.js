import Multer from 'multer';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import Vision from '@google-cloud/vision';
const config = require('../../config');
const CLOUD_BUCKET = config.get('CLOUD_BUCKET');
const SECRETS_DIR = path.join(__dirname, '../../', 'secrets');
const ERROR_REASON = {
  NO_TEXT_DETECTED: 'NO_TEXT_DETECTED',
};

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
    textDetection(gcsname).then((textDetection) => {
      req.file.cloudStorageObject = gcsname;
      req.file.cloudStoragePublicUrl = getPublicUrl(gcsname);
      req.textDetection = textDetection;
      next();
    })
    .catch((err) => {
      objectDetection(gcsname).then((objectDetection) => {
        req.objectDetection = objectDetection;
        next(err);
      });
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
      if (fullTextAnnotation && fullTextAnnotation.text && fullTextAnnotation.length > 0) {
        let text = fullTextAnnotation.text.replace(/\s/g, ' ');
        return text;
      } else {
        throw new Error(ERROR_REASON.NO_TEXT_DETECTED);
      }
    });
}

function objectDetection(filename) {
  const gsUri = `gs://${CLOUD_BUCKET}/${filename}`;
  return vision.objectLocalization(gsUri)
    .then(([result]) => {
      let objectDetection = 'Mystery';
      const objects = result.localizedObjectAnnotations;
      if (objects && objects.length > 0) {
        objectDetection = objects[0].name;
      }
      return objectDetection;
    })
}

module.exports = {
  getPublicUrl,
  sendUploadToGCS,
  multer
};
