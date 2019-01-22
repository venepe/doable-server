exports.shorthands = undefined;

exports.up = (pgm) => {

  pgm.createSchema('doable');

  pgm.createTable({schema: 'doable', name: 'user'}, {
    id: 'id',
    uid: { type: 'varchar', unique: true , notNull: true },
    email: { type: 'varchar', notNull: true },
    created_at: {
     type: 'timestamp',
     notNull: true,
     default: pgm.func('current_timestamp')
   },
   is_archived: {
     type: 'boolean',
     notNull: true,
     default: false,
   },
 });

  pgm.createIndex({schema: 'doable', name: 'user'}, 'email');

  pgm.createIndex({schema: 'doable', name: 'user'}, 'uid');

  pgm.createTable({schema: 'doable', name: 'deck'}, {
    id: 'id',
    user_uid: {
      type: 'varchar',
      notNull: true,
      references: 'doable.user (uid)',
    },
    title: { type: 'varchar' },
    description: { type: 'varchar' },
    created_at: {
     type: 'timestamp',
     notNull: true,
     default: pgm.func('current_timestamp')
   },
   is_archived: {
     type: 'boolean',
     notNull: true,
     default: false,
   },
 });

  pgm.createIndex({schema: 'doable', name: 'deck'}, 'title');

  pgm.createIndex({schema: 'doable', name: 'deck'}, 'description');

  pgm.createTable({schema: 'doable', name: 'document'}, {
    id: 'id',
    user_uid: {
      type: 'varchar',
      notNull: true,
      references: 'doable.user (uid)',
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
   },
   is_archived: {
     type: 'boolean',
     notNull: true,
     default: false,
   },
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
    },
    is_archived: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
  });

  pgm.createFunction(
    {schema: 'doable', name: 'search_decks'},
    [{name: 'search', type: 'text'}],
    {returns: 'setof doable.deck', language: 'sql', behavior: 'stable'},
    " select deck.* from doable.deck as deck where deck.title ilike ('%' || search || '%') or deck.description ilike ('%' || search || '%') group by deck.id "
  );

  pgm.createFunction(
    {schema: 'doable', name: 'logon_user'},
    [{name: 'uid', type: 'text'}, {name: 'email', type: 'text'}],
    {returns: 'doable.user', language: 'sql', behavior: 'volatile'},
    " insert into doable.user (uid, email) values (uid, email) ON CONFLICT (uid) DO UPDATE SET uid = EXCLUDED.uid RETURNING *"
  );

};

exports.down = (pgm) => {

};
