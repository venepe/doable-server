exports.shorthands = undefined;

exports.up = (pgm) => {

  pgm.createSchema('doable');

  pgm.createTable({schema: 'doable', name: 'user'}, {
    id: 'id',
    email: { type: 'varchar' },
    created_at: {
     type: 'timestamp',
     notNull: true,
     default: pgm.func('current_timestamp')
    }
 });

  pgm.createIndex({schema: 'doable', name: 'user'}, 'email');

  pgm.createTable({schema: 'doable', name: 'deck'}, {
    id: 'id',
    title: { type: 'varchar' },
    description: { type: 'varchar' },
    created_at: {
     type: 'timestamp',
     notNull: true,
     default: pgm.func('current_timestamp')
    }
 });

  pgm.createIndex({schema: 'doable', name: 'deck'}, 'title');

  pgm.createIndex({schema: 'doable', name: 'deck'}, 'description');

  pgm.createTable({schema: 'doable', name: 'audiocard'}, {
    id: 'id',
    question_text: { type: 'varchar' },
    question_audio_uri: { type: 'varchar' },
    answer_text: { type: 'varchar' },
    answer_audio_uri: { type: 'varchar' },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  pgm.createTable({schema: 'doable', name: 'deck_audiocard'}, {
    id: 'id',
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

  pgm.createIndex({schema: 'doable', name: 'deck_audiocard'}, 'audiocard_id');

  pgm.createIndex({schema: 'doable', name: 'deck_audiocard'}, 'deck_id');

  pgm.createFunction(
    {schema: 'doable', name: 'search_decks'},
    [{name: 'search', type: 'text'}],
    {returns: 'setof doable.deck', language: 'sql', behavior: 'stable'},
    " select deck.* from doable.deck as deck where deck.title ilike ('%' || search || '%') or deck.description ilike ('%' || search || '%') group by deck.id "
  );

};

exports.down = (pgm) => {

};
