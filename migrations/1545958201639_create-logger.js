exports.shorthands = undefined;

exports.up = (pgm) => {

  pgm.createSchema('logger');

  pgm.createTable({schema: 'logger', name: 'search'}, {
   id: 'id',
   text: { type: 'varchar' },
   created_at: {
     type: 'timestamp',
     notNull: true,
     default: pgm.func('current_timestamp')
   }
  });

  pgm.createIndex({schema: 'logger', name: 'search'}, 'text');

  pgm.createTable({schema: 'logger', name: 'interactive_session'}, {
   id: 'id',
   uid: {
     type: 'varchar',
     notNull: false,
   },
   user_id: {
     type: 'integer',
     notNull: false,
     references: 'doable.user',
   },
   audiocard_id: {
     type: 'integer',
     notNull: true,
     references: 'doable.audiocard',
   },
   deck_id: {
     type: 'integer',
     notNull: true,
     references: 'doable.deck',
   },
   response: { type: 'varchar' },
   is_correct: { type: 'boolean' },
   created_at: {
     type: 'timestamp',
     notNull: true,
     default: pgm.func('current_timestamp')
   }
  });

  pgm.createTable({schema: 'logger', name: 'audio_session'}, {
   id: 'id',
   uid: {
     type: 'varchar',
     notNull: false,
   },
   user_id: {
     type: 'integer',
     notNull: false,
     references: 'doable.user',
   },
   audiocard_id: {
     type: 'integer',
     notNull: true,
     references: 'doable.audiocard',
   },
   deck_id: {
     type: 'integer',
     notNull: true,
     references: 'doable.deck',
   },
   created_at: {
     type: 'timestamp',
     notNull: true,
     default: pgm.func('current_timestamp')
   }
  });

};

exports.down = (pgm) => {

};
