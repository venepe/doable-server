exports.shorthands = undefined;

exports.up = (pgm) => {

  pgm.createSchema('chronicle');

  pgm.createTable({schema: 'chronicle', name: 'document'}, {
   id: 'id',
   hash: { type: 'varchar' },
   pdf_uri: { type: 'varchar' },
   thumbnail_prefix: { type: 'varchar' },
   ocr_uri: { type: 'varchar' },
   created_at: {
     type: 'timestamp',
     notNull: true,
     default: pgm.func('current_timestamp')
   }
  });

  pgm.createIndex({schema: 'chronicle', name: 'document'}, 'hash');

};

exports.down = (pgm) => {
  pgm.dropTable({schema: 'chronicle', name: 'document'});
  pgm.dropSchema('chronicle');
};
