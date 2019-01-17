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
    user_id: {
      type: 'integer',
      notNull: true,
      references: 'doable.user',
    },
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

  pgm.createTable({schema: 'doable', name: 'document'}, {
    id: 'id',
    user_id: {
      type: 'integer',
      notNull: true,
      references: 'doable.user',
    },
    deck_id: {
      type: 'integer',
      notNull: true,
      references: 'doable.deck',
    },
    image_uri: { type: 'varchar' },
    text: { type: 'varchar' },
    created_at: {
     type: 'timestamp',
     notNull: true,
     default: pgm.func('current_timestamp')
    }
 });

  pgm.createTable({schema: 'doable', name: 'card'}, {
    id: 'id',
    document_id: {
      type: 'integer',
      notNull: true,
      references: 'doable.document',
    },
    deck_id: {
      type: 'integer',
      notNull: true,
      references: 'doable.deck',
    },
    front_text: { type: 'varchar' },
    back_text: { type: 'varchar' },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  pgm.createFunction(
    {schema: 'doable', name: 'search_decks'},
    [{name: 'search', type: 'text'}],
    {returns: 'setof doable.deck', language: 'sql', behavior: 'stable'},
    " select deck.* from doable.deck as deck where deck.title ilike ('%' || search || '%') or deck.description ilike ('%' || search || '%') group by deck.id "
  );

};

exports.down = (pgm) => {

};
