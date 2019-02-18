import Multer from 'multer';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import Vision from '@google-cloud/vision';
import ConvertApi from 'convertapi';
import request from 'request';
import md5 from 'md5';
const config = require('../../config');
const CLOUD_BUCKET = config.get('CLOUD_BUCKET');
const CONVERT_API_SECRET = config.get('CONVERT_API_SECRET');
const SECRETS_DIR = path.join(__dirname, '../../', 'secrets');
const ERROR_REASON = {
  NO_TEXT_DETECTED: 'NO_TEXT_DETECTED',
};
const PDF_PAGE_LIMIT = 100;

const storage = new Storage({
  projectId: 'doable',
  keyFilename: `${SECRETS_DIR}/doable-batch.json`,
});

const vision = new Vision.ImageAnnotatorClient({
  projectId: 'doable',
  keyFilename: `${SECRETS_DIR}/doable-batch.json`,
});

const bucket = storage.bucket(CLOUD_BUCKET);

const convertApi = ConvertApi(CONVERT_API_SECRET);

const multer = Multer({
  storage: Multer.MemoryStorage,
  limits: {
    fileSize: 12 * 1024 * 1024,
  },
});

function getGCUri(filename) {
  return `gs://${CLOUD_BUCKET}/${filename}`;
}

function getPublicUrl(filename) {
  return `https://storage.googleapis.com/${CLOUD_BUCKET}/${filename}`;
}

function getPublicThumbnailUrl({ prefix, index }) {
  return getPublicUrl(`${prefix}/thumbnails/${index}/${prefix}.jpg`);
}

function insertIntoChronicle({ pool, hash, pdfUri, thumbnailPrefix, ocrUri }) {
  const insert = 'INSERT INTO chronicle.document(hash, pdf_uri, thumbnail_prefix, ocr_uri) VALUES($1, $2, $3, $4) RETURNING *';
  return pool.query({ text: insert, values: [ hash, pdfUri, thumbnailPrefix, ocrUri ] });
}

function selectHashFromChronicle({ pool, hash }) {
  const select = 'SELECT * FROM chronicle.document WHERE hash = $1';
  return pool.query({ text: select, values: [ hash ] });
}

function sendUploadToGCS (req, res, next) {
  if (!req.file) {
    return next();
  }
  const pool = req.pool;
  const { buffer, originalname, mimetype } = req.file;

  if (!mimetype.match('application/pdf')) {
    return next();
  }

  let hash = md5(buffer);

  selectHashFromChronicle({ pool, hash }).then((result) => {
    if (result && result.rows && result.rows.length > 0) {
      const { pdf_uri, thumbnail_prefix, ocr_uri } = result.rows[0];
      req.file.cloudStoragePDFPublicUrl = getPublicUrl(pdf_uri);
      req.file.cloudStorageThumbnailPrefix = thumbnail_prefix;
      storage.bucket(CLOUD_BUCKET).file(ocr_uri).download()
      .then((data) => { return data.toString('utf-8') })
      .then((data) => { return JSON.parse(data) })
      .then((data) => {
        let textDetections = [];
        data.responses.forEach(response => {
          let text = response.fullTextAnnotation.text.replace(/\s/g, ' ');
          textDetections.push(text)
        });
        req.textDetections = textDetections;
        next();
      })
    } else {
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
        req.file.cloudStoragePDFObject = gcsname;
        req.file.cloudStoragePDFPublicUrl = getPublicUrl(gcsname);

        convertPDFToThumbnail(gcsname)
          .then(({ prefix }) => {
            req.file.cloudStorageThumbnailObject = gcsname;
            req.file.cloudStorageThumbnailPrefix = prefix;
            return textPdfDetection(gcsname);
          })
          .then((prefix) => {
            return storage.bucket(CLOUD_BUCKET).getFiles({ prefix: `${prefix}/` })
          })
          .then(([files]) => {
            req.file.cloudStorageOCRObject = files[0].name;
            return storage.bucket(CLOUD_BUCKET).file(files[0].name).download()
          })
          .then((data) => { return data.toString('utf-8') })
          .then((data) => { return JSON.parse(data) })
          .then((data) => {
            let textDetections = [];
            data.responses.forEach(response => {
              let text = response.fullTextAnnotation.text.replace(/\s/g, ' ');
              textDetections.push(text)
            });
            req.textDetections = textDetections;
          })
          .then(() => {
            let gcsname = req.file.cloudStoragePDFObject;
          })
          .then(() => {
            let pdfUri = req.file.cloudStoragePDFObject;
            let thumbnailPrefix = req.file.cloudStorageThumbnailPrefix;
            let ocrUri = req.file.cloudStorageOCRObject;
            let gcsname = req.file.cloudStorageObject;
            return insertIntoChronicle({ pool, hash, pdfUri, thumbnailPrefix, ocrUri });
          })
          .then(() => {
            next();
          })
          .catch((err) => {
            req.errorMessage = err;
            next(err);
          });
        });

        stream.end(buffer);
      }
    });
}

function uploadPdfThumbnail(uri, gcsname) {
  return new Promise((resolve, reject) => {
    const file = bucket.file(gcsname);
    const mimetype = 'image/jpeg';

    const stream = file.createWriteStream({
      resumable: false,
      metadata: {
        cacheControl: 'public, max-age=31536000',
        contentType: mimetype,
      },
      predefinedAcl: 'publicRead',
    });

    stream.on('error', (err) => {
      console.log(err);
      reject();
    });

    stream.on('finish', () => {
      console.log(gcsname);
      resolve(gcsname);
    });

    request(uri).pipe(stream);
  });
}

function convertPDFToThumbnail(gcsname) {
  return new Promise((resolve, reject) => {
    let uri = getPublicUrl(gcsname);
    let prefix = gcsname.replace(/\.[^/.]+$/, '');
    convertApi
      .convert('jpg', { File: uri }, 'pdf')
      .then((result) => {
        if (result.files.length > PDF_PAGE_LIMIT) {
          reject(`Number of pages limited to ${PDF_PAGE_LIMIT}`);
          return;
        }

        let gcsUploads = result.files.map(({ fileInfo }, index) => {
          let uri = fileInfo.Url;
          let thumbnailGcsname = `${prefix}/thumbnails/${index}/${prefix}.jpg`;
          return uploadPdfThumbnail(uri, thumbnailGcsname);
        });
        return Promise.all(gcsUploads);
      })
      .then((results) => {
        resolve({ results, prefix });
      });
  });
}

async function textPdfDetection(filename) {
  console.log('textDetection: ' + filename);
  let prefix = filename.replace(/\.[^/.]+$/, '');
  const gcsSourceUri = getGCUri(filename);
  const gcsDestinationUri = `gs://${CLOUD_BUCKET}/${prefix}/`;

  const inputConfig = {
    mimeType: 'application/pdf',
    gcsSource: {
      uri: gcsSourceUri,
    },
  };
  const outputConfig = {
    gcsDestination: {
      uri: gcsDestinationUri,
    },
    batchSize: PDF_PAGE_LIMIT,
  };
  const features = [{type: 'DOCUMENT_TEXT_DETECTION'}];
  const request = {
    requests: [
      {
        inputConfig: inputConfig,
        features: features,
        outputConfig: outputConfig,
      },
    ],
  };
  const [operation] = await vision.asyncBatchAnnotateFiles(request);
  try {
    const [filesResponse] = await operation.promise();
    const destinationUri = filesResponse.responses[0].outputConfig.gcsDestination.uri;
    // await storage.bucket(CLOUD_BUCKET).file(filename).makePublic();
    return prefix;
  } catch (e) {
    console.log(e);
  }
}

module.exports = {
  getPublicUrl,
  getPublicThumbnailUrl,
  sendUploadToGCS,
  multer
};
