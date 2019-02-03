exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns({schema: 'doable', name: 'card'}, {
    front_text_indexes: { type: 'json' },
    back_text_indexes: { type: 'json' },
  });

  pgm.dropColumns({schema: 'doable', name: 'card'}, ['document_id']);
};

exports.down = (pgm) => {

};
