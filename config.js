const nconf = (module.exports = require('nconf'));
const path = require('path');

nconf
  // 1. Command-line arguments
  .argv()
  // 2. Environment variables
  .env([
    'DATA_BACKEND',
    'GCLOUD_PROJECT',
    'INSTANCE_CONNECTION_NAME',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_HOST',
    'CLOUD_BUCKET',
    'NODE_ENV',
    'PORT',
    'CONVERT_API_SECRET',
  ])
  // 3. Config file
  .file({file: path.join(__dirname, 'config.json')})
  // 4. Defaults
  .defaults({
    // dataBackend can be 'datastore' or 'cloudsql'. Be sure to
    // configure the appropriate settings for each storage engine below.
    // If you are unsure, use datastore as it requires no additional
    // configuration.
    DATA_BACKEND: 'cloudsql',

    // This is the id of your project in the Google Cloud Developers Console.
    GCLOUD_PROJECT: 'doable',
    CLOUD_BUCKET: 'doable-learning',

    POSTGRES_USER: '',
    POSTGRES_PASSWORD: '',
    POSTGRES_HOST: 'localhost',

    PORT: 3000,
    CONVERT_API_SECRET: '',
  });

// Check for required settings
checkConfig('GCLOUD_PROJECT');

if (nconf.get('DATA_BACKEND') === 'cloudsql') {
  checkConfig('POSTGRES_USER');
  checkConfig('POSTGRES_PASSWORD');
  if (nconf.get('NODE_ENV') === 'production') {
    checkConfig('INSTANCE_CONNECTION_NAME');
  }
}

function checkConfig(setting) {
  if (!nconf.get(setting)) {
    throw new Error(
      'You must set ' + setting + ' as an environment variable or in config.json!'
    );
  }
}
