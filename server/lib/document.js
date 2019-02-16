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

function insertIntoChronicle({ pool, hash, pdfUri, thumbnailUri, ocrUri }) {
  const insert = 'INSERT INTO chronicle.document(hash, pdf_uri, thumbnail_uri, ocr_uri) VALUES($1, $2, $3, $4) RETURNING *';
  return pool.query({ text: insert, values: [ hash, pdfUri, thumbnailUri, ocrUri ] });
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

  let hash = md5(buffer);

  selectHashFromChronicle({ pool, hash }).then((result) => {
    if (result && result.rows && result.rows.length > 0) {
      const { pdf_uri, thumbnail_uri, ocr_uri } = result.rows[0];
      req.file.cloudStoragePDFPublicUrl = getPublicUrl(pdf_uri);
      req.file.cloudStorageThumbnailPublicUrl = getPublicUrl(thumbnail_uri);
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
        if (mimetype.match('image.*')) {
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
        } else {
          convertDocumentToPDF(getPublicUrl(gcsname), originalname)
            .then((gcsname) => {
              req.file.cloudStoragePDFObject = gcsname;
              req.file.cloudStoragePDFPublicUrl = getPublicUrl(gcsname);
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
              return convertPDFToThumbnail(getPublicUrl(gcsname), originalname)
            })
            .then((gcsname) => {
              req.file.cloudStorageThumbnailObject = gcsname;
              req.file.cloudStorageThumbnailPublicUrl = getPublicUrl(gcsname);
            })
            .then(() => {
              let pdfUri = req.file.cloudStoragePDFObject;
              let thumbnailUri = req.file.cloudStorageThumbnailObject;
              let ocrUri = req.file.cloudStorageOCRObject;
              let gcsname = req.file.cloudStorageObject;
              return insertIntoChronicle({ pool, hash, pdfUri, thumbnailUri, ocrUri });
            })
            .then(() => {
              next();
            })
            .catch((err) => {
              next(err);
            });
        }
      });

      stream.end(buffer);
    }
  });
}

function convertDocumentToPDF(uri, originalName) {
  return new Promise((resolve, reject) => {
    convertApi
      .convert('pdf', { File: uri })
      .then((result) => {
        let newName = originalName.replace(/\.[^/.]+$/, '')
        const gcsname = Date.now() + newName + '.pdf';
        const file = bucket.file(gcsname);
        const mimetype = 'application/pdf';

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
          console.log('did error');
          reject();
        });

        stream.on('finish', () => {
          resolve(gcsname);
        });

        request(result.file.url).pipe(stream);

      });
  });
}

function convertPDFToThumbnail(uri, originalName) {
  return new Promise((resolve, reject) => {
    convertApi
      .convert('thumbnail', { File: uri }, 'pdf')
      .then((result) => {
        let newName = originalName.replace(/\.[^/.]+$/, '')
        const gcsname = Date.now() + newName + '.jpg';
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
          console.log('did error');
          reject();
        });

        stream.on('finish', () => {
          resolve(gcsname);
        });

        request(result.file.url).pipe(stream);

      });
  });
}

function textDetection(filename) {
  const gsUri = getGCUri(filename);
  return vision.documentTextDetection(gsUri)
    .then(([result]) => {
      const fullTextAnnotation = result.fullTextAnnotation;
      if (fullTextAnnotation && fullTextAnnotation.text) {
        let text = fullTextAnnotation.text.replace(/\s/g, ' ');
        return text;
      } else {
        throw new Error(ERROR_REASON.NO_TEXT_DETECTED);
      }
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
    batchSize: 100,
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

function objectDetection(filename) {
  const gsUri = getGCUri(filename);
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
